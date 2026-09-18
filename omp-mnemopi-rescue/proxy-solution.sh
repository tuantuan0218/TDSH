D=/Users/zhaozicheng/.omp/agent
NP="voyager.olomc.top,api.xn--20t60kxs4bjxb.top,192.168.1.3,localhost,127.0.0.1"
echo "候选方案: HTTPS_PROXY=127.0.0.1:7897 + NO_PROXY=$NP"
gp() {
  P=$1
  K=$(awk -v p="$P" '$0 ~ "^  "p":" {f=1;next} f&&/^  [a-z]/{f=0} f&&/apiKey:/{sub(/.*apiKey: */,"");print;exit}' $D/models.yml)
  B=$(awk -v p="$P" '$0 ~ "^  "p":" {f=1;next} f&&/^  [a-z]/{f=0} f&&/baseUrl:/{sub(/.*baseUrl: */,"");print;exit}' $D/models.yml)
  M=$(awk -v p="$P" '$0 ~ "^  "p":" {f=1;next} f&&/^  [a-z]/{f=0} f&&/^    - /{g=1} g&&/id:/{sub(/.*id: */,"");print;exit}' $D/models.yml)
  echo -n "  $P : "
  HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 NO_PROXY="$NP" no_proxy="$NP" \
  curl -s -m 40 -A "Mozilla/5.0" -H "Authorization: Bearer $K" -H "content-type: application/json" \
    -d "{\"model\":\"$M\",\"messages\":[{\"role\":\"user\",\"content\":\"只回答数字：17乘以23等于多少？\"}],\"max_tokens\":64}" \
    "$B/chat/completions" -w "HTTP %{http_code}" -o /tmp/_g.json 2>/dev/null
  echo " body=$(head -c 130 /tmp/_g.json)"
}
gp olo
gp aio
gp tuan
gp wb
gp agnes
echo "=== DONE ==="