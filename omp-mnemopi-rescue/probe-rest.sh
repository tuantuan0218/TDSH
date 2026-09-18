D=/Users/zhaozicheng/.omp/agent
probe() {
  P=$1
  K=$(awk -v p="$P" '$0 ~ "^  "p":" {f=1;next} f&&/^  [a-z]/{f=0} f&&/apiKey:/{sub(/.*apiKey: */,"");print;exit}' $D/models.yml)
  B=$(awk -v p="$P" '$0 ~ "^  "p":" {f=1;next} f&&/^  [a-z]/{f=0} f&&/baseUrl:/{sub(/.*baseUrl: */,"");print;exit}' $D/models.yml)
  M=$(awk -v p="$P" '$0 ~ "^  "p":" {f=1;next} f&&/^  [a-z]/{f=0} f&&/^    - /{g=1} g&&/id:/{sub(/.*id: */,"");print;exit}' $D/models.yml)
  echo "### $P  base=$B model=$M key=${K:0:5}...${K: -3}"
  echo -n "  direct      : "
  curl -s -m 40 -A "Mozilla/5.0" -H "Authorization: Bearer $K" -H "content-type: application/json" \
    -d "{\"model\":\"$M\",\"messages\":[{\"role\":\"user\",\"content\":\"只回答数字：17乘以23等于多少？\"}],\"max_tokens\":64}" \
    "$B/chat/completions" -w "HTTP %{http_code}" -o /tmp/_r1.json 2>/dev/null
  echo "  body=$(head -c 160 /tmp/_r1.json 2>/dev/null)"
  echo -n "  proxy7897   : "
  curl -s -m 40 -x http://127.0.0.1:7897 -A "Mozilla/5.0" -H "Authorization: Bearer $K" -H "content-type: application/json" \
    -d "{\"model\":\"$M\",\"messages\":[{\"role\":\"user\",\"content\":\"只回答数字：17乘以23等于多少？\"}],\"max_tokens\":64}" \
    "$B/chat/completions" -w "HTTP %{http_code}" -o /tmp/_r2.json 2>/dev/null
  echo "  body=$(head -c 160 /tmp/_r2.json 2>/dev/null)"
}
probe aio
probe tuan
probe wb
probe agnes
echo "=== DONE ==="