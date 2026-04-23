const fs = require('fs');
fetch('http://localhost:5000/api/qr').then(r=>r.json()).then(d => {
  fs.writeFileSync('debug_qr.json', JSON.stringify(d.slice(0, 3), null, 2));
  console.log("Done");
});
