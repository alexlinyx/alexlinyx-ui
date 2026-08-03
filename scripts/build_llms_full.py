#!/usr/bin/env python3
"""Generate llms-full.txt from llms.txt + content/*.md.

llms-full.txt is the whole site concatenated into one file so an LLM can read
everything in a single request (llmstxt.org convention). It is generated at
deploy time by .github/workflows/pages.yml — never edit it by hand, and no
committed copy exists to go stale. Run locally to preview:

    python3 scripts/build_llms_full.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://alexlinyx.com"
CONTENT_LINK = re.compile(r"\[[^\]]*\]\((?:https://alexlinyx\.com)?(/content/[\w-]+\.md)\)")


def main() -> None:
    index = (ROOT / "llms.txt").read_text()

    paths: list[str] = []
    for path in CONTENT_LINK.findall(index):
        if path not in paths:
            paths.append(path)

    parts = [
        "<!-- Generated from llms.txt and content/*.md by"
        " scripts/build_llms_full.py — do not edit by hand. -->",
        index.strip(),
    ]
    for path in paths:
        page = (ROOT / path.lstrip("/")).read_text().strip()
        parts.append(f"---\n\n<!-- Source: {SITE}{path} -->\n\n{page}")

    (ROOT / "llms-full.txt").write_text("\n\n".join(parts) + "\n")
    print(f"llms-full.txt: {len(paths)} pages inlined")


if __name__ == "__main__":
    main()
