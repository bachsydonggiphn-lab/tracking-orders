// Test the cargo tracking API via local server
const res = await fetch('http://localhost:5000/api/track/jnt-cargo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ billCode: '530494080208' })
});
const json = await res.json();
console.log('Status:', res.status);
console.log('Result:', JSON.stringify(json, null, 2));
