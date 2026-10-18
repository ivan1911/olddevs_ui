---
"@olddevs/ui": patch
---

Editor: a pasted link keeps its own address when its text looks like an address. A link such as `<a href="https://example.com/docs?page=1#top">example.com/docs</a>` copied from Word or a web page lost its query and anchor (or its whole address when the text named another page), because the paste rule relinked the text. A bare address in pasted text now gets `https://`, like one typed by hand, instead of `http://`.
