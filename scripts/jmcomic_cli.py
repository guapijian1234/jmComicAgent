#!/usr/bin/env python3
"""Thin CLI wrapper around jmcomic library for the Electron agent."""

import argparse
import json
import os
import sys


def _build_option():
    from jmcomic import JmOption, JmModuleConfig, disable_jm_log, set_application_workspace

    workspace = os.path.join(os.path.expanduser("~"), ".jmcomic")
    set_application_workspace(workspace)

    # Silence jmcomic's stdout logging so stdout carries only our JSON.
    disable_jm_log()

    # Cookies are REQUIRED by the mobile API client — without them the API
    # returns the correct `total` but an empty `content` list. Now that traffic
    # is routed through the proxy, the /setting request to fetch cookies works.
    # (Do NOT set FLAG_API_CLIENT_REQUIRE_COOKIES = False.)
    JmModuleConfig.FLAG_API_CLIENT_AUTO_UPDATE_DOMAIN = True

    # Route through Clash Verge proxy
    proxy_url = "http://127.0.0.1:7897"
    os.environ.setdefault("HTTP_PROXY", proxy_url)
    os.environ.setdefault("HTTPS_PROXY", proxy_url)

    # construct() (not the constructor) merges the default option dict first,
    # so omitted keys like download.image.suffix fall back to their defaults
    # instead of raising KeyError at download time.
    return JmOption.construct({
        # dir_rule: Bd_Aid_Pid = base_dir / album_id / photo_id.
        # The Pid segment is ESSENTIAL for multi-chapter albums. A jmcomic
        # "album"'s id is the photo_id of its FIRST chapter, so every chapter
        # shares the same Aid — without Pid, all chapters land in the same
        # folder (base_dir/<aid>/00001.webp...) and overwrite each other, and
        # with cache=True chapter 2+ silently re-reads chapter 1's images
        # instead of downloading its own. That made every chapter on the phone
        # (and desktop) display chapter 1's pages.
        "dir_rule": {"rule": "Bd_Aid_Pid", "base_dir": workspace},
        # decode=True: JM page images are scrambled (horizontal segments
        # rearranged by an md5-derived count). The downloader fetches the
        # scrambled bytes and writes the DECODED image to disk — without this,
        # a raw CDN url would render as a garbled puzzle.
        # cache=True: skip re-downloading images already on disk (instant re-reads).
        # threading.image=10: parallel image fetch so a full chapter loads in
        # seconds rather than one-at-a-time.
        "download": {
            "cache": True,
            "image": {"decode": True},
            "threading": {"image": 10, "photo": 4},
        },
        "client": {
            "domain": [],
            "postman": {"type": "cffi", "meta_data": {}},
            "retry_times": 3,
            # cache=False: search results are cached per-process, which would
            # make our empty-result retry below return the cached empty list.
            "cache": False,
            "impl": "api",
        },
        "plugins": {},
        # disable_jm_log() already called above; keep log off here too.
        "log": False,
        "call_after_init_plugin": False,
    })


def _build_client():
    return _build_option().build_jm_client()


def _enrich_albums(albums):
    """Flatten [id, obj] tuples into flat dicts and attach a built cover_url.

    jmcomic's search returns content as [[id, album], ...] tuples and the
    `image` field is empty — the cover URL must be derived from the album id.
    """
    from jmcomic import JmcomicText

    flat = []
    for item in albums:
        # jmcomic returns content as (id, album_dict) tuples, not lists
        obj = item[1] if isinstance(item, (list, tuple)) and len(item) >= 2 else item
        if not isinstance(obj, dict):
            continue
        album_id = obj.get("id") or obj.get("album_id")
        if album_id and not obj.get("image"):
            obj["image"] = JmcomicText.get_album_cover_url(str(album_id))
        flat.append(obj)
    return flat


def _do_search(client, args):
    return client.search(
        args.keyword,
        page=int(args.page or 1),
        main_tag=int(args.main_tag or 0),
        order_by=args.order_by or "mr",
        time=args.time or "a",
        category=args.category or "0",
        sub_category=args.sub_category or "",
    )


def cmd_search(args):
    import time as _time

    client = _build_client()

    # The jmcomic search API is flaky: it can transiently return total=0 or an
    # empty content list even for valid queries (rate limiting / IP rotation).
    # Retry a few times until we get a non-empty content list.
    result = None
    data = {}
    for attempt in range(4):
        result = _do_search(client, args)
        data = _to_src_dict(result)
        content = data.get("content") if isinstance(data, dict) else None
        if isinstance(content, list) and len(content) > 0:
            data["content"] = _enrich_albums(content)
            _emit(data)
            return
        if attempt < 3:
            _time.sleep(1.0)

    # exhausted retries; emit whatever we have (may be empty)
    if isinstance(data, dict) and isinstance(data.get("content"), list):
        data["content"] = _enrich_albums(data["content"])
    _emit(data)


def cmd_album(args):
    client = _build_client()
    result = client.get_album_detail(args.album_id)
    data = _to_src_dict(result)
    if isinstance(data, dict):
        album_id = data.get("album_id") or data.get("id")
        if album_id and not data.get("image"):
            from jmcomic import JmcomicText
            data["image"] = JmcomicText.get_album_cover_url(str(album_id))
    _emit(data)


def _to_src_dict(obj):
    if hasattr(obj, "src_dict"):
        return obj.src_dict
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return obj


def cmd_chapter(args):
    # Download + DECODE a whole chapter to disk. JM page images are scrambled,
    # so we can't hand raw CDN urls to an <img> tag — jmcomic's downloader
    # fetches the scrambled bytes and writes the decoded image. We then return
    # the list of decoded local file paths for the renderer to serve.
    opt = _build_option()
    photo_id = args.chapter_id or args.album_id
    photo, _dler = opt.download_photo(photo_id)

    image_paths = []
    for img in photo:
        p = opt.decide_image_filepath(img)
        if p and os.path.exists(p):
            image_paths.append(p)

    _emit({
        "photo_id": photo.photo_id,
        "scramble_id": photo.scramble_id,
        "name": photo.name,
        "page_count": len(image_paths),
        "image_paths": image_paths,
    })


def _emit(obj):
    if hasattr(obj, "src_dict"):
        obj = obj.src_dict
    elif hasattr(obj, "__dict__"):
        obj = obj.__dict__

    text = json.dumps(obj, ensure_ascii=False, default=str)
    # Strip surrogate escapes that can't be encoded to UTF-8
    text = text.encode("utf-8", errors="surrogateescape").decode("utf-8", errors="replace")
    print(text)


def main():
    parser = argparse.ArgumentParser(description="jmcomic CLI")
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("search")
    p.add_argument("-k", "--keyword", required=True)
    p.add_argument("--page", default="1")
    p.add_argument("--main-tag", default="0")
    p.add_argument("--order-by", default="mr")
    p.add_argument("--time", default="a")
    p.add_argument("--category", default="0")
    p.add_argument("--sub-category", default="")

    p = sub.add_parser("album")
    p.add_argument("-a", "--album-id", required=True)

    p = sub.add_parser("chapter")
    p.add_argument("-a", "--album-id", required=True)
    p.add_argument("-c", "--chapter-id", required=True)

    args = parser.parse_args()
    if args.command == "search":
        cmd_search(args)
    elif args.command == "album":
        cmd_album(args)
    elif args.command == "chapter":
        cmd_chapter(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
