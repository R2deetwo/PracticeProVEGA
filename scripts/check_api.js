fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDd5ib2A1562gO2PY1FQElSVzwyIaeBAN8", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({"contents":[{"parts":[{"text":"hello"}]}]})
}).then(r => r.json()).then(console.log).catch(console.error);
