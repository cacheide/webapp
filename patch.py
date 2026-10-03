import re
p = "src/App.jsx"
s = open(p).read()
def sub(pat, rep, flags=0):
    global s
    s2, n = re.subn(pat, lambda m: rep, s, count=1, flags=flags)
    assert n == 1, "patch failed (already applied?): " + pat
    s = s2
sub(r'import Background from "\./Background\.jsx";', 'import Background from "./Background.jsx";\nimport Brand, { useOverscroll } from "./Brand.jsx";')
sub(r'      <h1 className="hero-title">CACHE</h1>\n      <p className="hero-sub">ON CHAIN ESCROW</p>', '      <Brand variant="hero" />')
sub(r'<header className="flex flex-wrap.*?</header>', '<div className="topbar"><div className="topbar-in"><span className="chip net">Base Sepolia</span><Connect /></div></div>\n          <div className="brand-zone"><Brand variant="header" /></div>', re.S)
sub(r'<nav className="tabs">', '<div className="pull-shift">\n          <nav className="tabs">')
sub(r'</footer>\n        </div>\n      \)\}', '</footer>\n          </div>\n        </div>\n      )}')
sub(r'relative z-10 mx-auto w-full max-w-2xl px-4 pb-16', 'relative z-10 mx-auto w-full max-w-2xl px-4 pb-16 pt-16')
sub(r'  const \{ address \} = useAccount\(\);\n', '  const { address } = useAccount();\n  useOverscroll();\n')
open(p, "w").write(s)
print("patched App.jsx")
