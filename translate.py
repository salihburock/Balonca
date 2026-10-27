"""Flamanca otomatik altyazıyı indirir, Türkçeye çevirir, subs.json yazar.

Kurulum:  pip install yt-dlp anthropic
Çalıştır: export ANTHROPIC_API_KEY=...   (Windows: set ANTHROPIC_API_KEY=...)
          python translate.py                       # aşağıdaki varsayılan video
          python translate.py URL [kaynak_dil] [hedef_dil]
          python translate.py https://youtu.be/XXXXXXXXXXX nl Türkçe
Çıktı: subs.json  (Balonca'ya "Altyazılar" sekmesinden yükle)
"""
import glob, json, os, subprocess, sys
import anthropic

URL = sys.argv[1] if len(sys.argv) > 1 else "https://youtu.be/abcdefghijk"
LANG = sys.argv[2] if len(sys.argv) > 2 else "nl"          # altyazı dili
TARGET = sys.argv[3] if len(sys.argv) > 3 else "Türkçe"    # hedef dil
BATCH = 25
MODEL = "claude-sonnet-5-5"

# 1) Altyazıyı indir (json3 formatı otomatik altyazıda en temizi)
subprocess.run([
    "yt-dlp", "--write-auto-subs", "--write-subs", "--sub-langs", LANG,
    "--sub-format", "json3", "--skip-download", "-o", "video", URL,
], check=True)

files = glob.glob(f"video*.{LANG}*.json3")
if not files:
    sys.exit("Altyazı inmedi. 'yt-dlp --list-subs' ile kontrol et; yoksa Whisper gerekir.")

# 2) json3 -> [{start, end, text}]
events = json.load(open(files[0], encoding="utf-8"))["events"]
segs = []
for e in events:
    if "segs" not in e:
        continue
    text = "".join(s.get("utf8", "") for s in e["segs"]).replace("\n", " ").strip()
    if not text:
        continue
    start = e["tStartMs"] / 1000
    segs.append({"start": start, "end": start + e.get("dDurationMs", 2000) / 1000, "text": text})
for a, b in zip(segs, segs[1:]):          # çakışmaları kes
    a["end"] = min(a["end"], b["start"])

# 3) Türkçeye çevir
client = anthropic.Anthropic()
SYSTEM = (
    "Sen çizgi film altyazı çevirmenisin. Girdi, Flamanca (Felemenkçe) otomatik altyazı satırlarından "
    "oluşan bir JSON listesidir; noktalama yok, hatalar ve bölünmüş cümleler olabilir. Bağlama göre "
    f"düzelterek doğal, kısa, konuşma dilinde {TARGET} diline çevir. SADECE aynı uzunlukta bir JSON string "
    "listesi döndür; her girdi satırına bir çıktı satırı karşılık gelsin. Başka metin ekleme."
)
for i in range(0, len(segs), BATCH):
    chunk = segs[i:i + BATCH]
    # bağlam için önceki 3 satırı da göster ama çevirtme
    r = client.messages.create(
        model=MODEL, max_tokens=4000, system=SYSTEM,
        messages=[{"role": "user", "content": json.dumps([s["text"] for s in chunk], ensure_ascii=False)}],
    )
    out = r.content[0].text.strip().strip("`").removeprefix("json").strip()
    tr = json.loads(out)
    if len(tr) != len(chunk):
        sys.exit(f"Satır sayısı tutmadı (grup {i}). Tekrar çalıştır veya BATCH'i küçült.")
    for s, t in zip(chunk, tr):
        s["text"] = t
    print(f"{min(i + BATCH, len(segs))}/{len(segs)}")

json.dump(segs, open("subs.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("subs.json hazır")
