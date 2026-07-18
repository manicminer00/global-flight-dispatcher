# -*- coding: utf-8 -*-
from pathlib import Path
path = Path(r"D:\CURSOR WORKSPACE\VECTOR DEVELOPMENT v3.0\index.html")
text = path.read_text(encoding="utf-8")
start = text.index("        .contracts-ticket-grid {")
end = text.index("        #logbookPanel.board-logbook {")
new_css = Path(__file__).resolve().parent / "_ticket_css_snippet.css"
# write snippet then splice
