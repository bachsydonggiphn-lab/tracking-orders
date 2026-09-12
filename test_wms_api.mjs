// Find VN02 warehouse field for filtering - E4=7
const baseUrl = 'http://czwh.wms.yunwms.com';
const passwordBase64 = Buffer.from('12345abc').toString('base64');
const loginFormBody = new URLSearchParams();
loginFormBody.append('userName', 'David');
loginFormBody.append('userPass', passwordBase64);

const loginRes = await fetch(baseUrl + '/login.html', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
  body: loginFormBody
});
const setCookie = loginRes.headers.get('set-cookie') || '';
const phpsessid = setCookie.match(/PHPSESSID=([^;]+)/)?.[1] || '';
console.log('PHPSESSID:', phpsessid ? 'OK' : 'FAIL');

// Fetch VN02 orders (E4=7)
const body = new URLSearchParams({ E4: '7' });
const res = await fetch(baseUrl + '/order/orders/list/page/1/pageSize/50', {
  method: 'POST',
  headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
  body
});
const json = await res.json();
console.log('[VN02] Total orders:', json.total);
console.log('[VN02] Sample count:', json.data?.length);

// Analyze all key status fields
const statusMap = {};
let withShipTime = 0, withPackTime = 0, withProcessTime = 0;

json.data?.forEach(o => {
  if (o.ship_time && o.ship_time !== '0000-00-00 00:00:00' && o.ship_time.trim()) withShipTime++;
  if (o.pack_time && o.pack_time !== '0000-00-00 00:00:00' && o.pack_time.trim()) withPackTime++;
  if (o.process_time && o.process_time !== '0000-00-00 00:00:00' && o.process_time.trim()) withProcessTime++;
  
  const key = `E10=${o.E10}`;
  statusMap[key] = (statusMap[key] || 0) + 1;
});

console.log('[VN02] E10 status distribution:', JSON.stringify(statusMap));
console.log('[VN02] with ship_time:', withShipTime);
console.log('[VN02] with pack_time:', withPackTime);
console.log('[VN02] with process_time:', withProcessTime);

// Sample orders with different E10 values
const e10_5 = json.data?.filter(o => o.E10 === '5');
const e10_4 = json.data?.filter(o => o.E10 === '4');
const e10_3 = json.data?.filter(o => o.E10 === '3');
const e10_2 = json.data?.filter(o => o.E10 === '2');
const e10_1 = json.data?.filter(o => o.E10 === '1');

console.log('\n[E10 breakdown] 1:', e10_1?.length, '2:', e10_2?.length, '3:', e10_3?.length, '4:', e10_4?.length, '5:', e10_5?.length);

if (e10_5?.length > 0) {
  const s = e10_5[0];
  console.log('\n[E10=5 sample] tracking:', s.tracking_number, '| ship_time:', s.ship_time, '| out_type:', s.out_type);
}
if (e10_4?.length > 0) {
  const s = e10_4[0];
  console.log('\n[E10=4 sample] tracking:', s.tracking_number, '| ship_time:', s.ship_time, '| out_type:', s.out_type);
}

// Now check the WMS HTML for what the filter field name is
// Look for warehouse filter in the POST request
console.log('\n[FILTER TEST] Trying different filter params for warehouse...');
const params = [
  { E4: '7' },
  { warehouseId: '7' },
  { warehouse_id: '7' },
  { wid: '7' },
];

for (const param of params) {
  const body2 = new URLSearchParams(param);
  const res2 = await fetch(baseUrl + '/order/orders/list/page/1/pageSize/2', {
    method: 'POST',
    headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
    body: body2
  });
  const json2 = await res2.json();
  console.log('[FILTER TEST] param:', JSON.stringify(param), '| total:', json2.total, '| first_tracking:', json2.data?.[0]?.tracking_number);
}

// Check the network request that the WMS page makes by looking at the form submit action
console.log('\n[PAGES] Total orders page (pageSize=200) to get ALL VN02 orders...');
const allRes = await fetch(baseUrl + '/order/orders/list/page/1/pageSize/200', {
  method: 'POST',
  headers: { 'Cookie': 'PHPSESSID=' + phpsessid, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
  body: new URLSearchParams({ E4: '7' })
});
const allJson = await allRes.json();
console.log('[PAGES] VN02 page 1 (size 200):', allJson.total, 'orders,', allJson.data?.length, 'returned');

// Analyze first 200 VN02 orders for tracking
const trackings = allJson.data?.map(o => o.tracking_number).filter(Boolean);
console.log('[PAGES] First 10 tracking numbers:', trackings?.slice(0, 10));
