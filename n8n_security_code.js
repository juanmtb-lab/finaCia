/* NODES: PROCESAMIENTO EXCLUSIVO DE NEGOCIO + SEGURIDAD */
const heads = $input.all()[0].json.headers || {};
const apiKey = 'finacia_secret_key_2026';

// 1. Verificación de Seguridad (Soporta varias mayúsculas/minúsculas)
const receivedKey = heads['x-dashboard-key'] || heads['X-Dashboard-Key'] || heads['X-DASHBOARD-KEY'];

if (receivedKey !== apiKey) {
  throw new Error(`API Key inválida o ausente (Recibido: ${receivedKey ? 'SI' : 'NO'})`);
}

const inputData = $input.all();
const business = { transactions: [] };

function cleanCurrency(val) {
  if (val === undefined || val === null || val === "") return 0;
  try {
    let s = String(val).replace(/[€*%\\s\\(\\)]/g, '').trim();
    if (s === "" || s === "-") return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (s.includes('.')) {
      const parts = s.split('.');
      if (parts[parts.length-1].length === 3) s = s.replace(/\\./g, '');
    }
    return parseFloat(s) || 0;
  } catch (e) { return 0; }
}

for (const item of inputData) {
  const json = item.json; if (!json) continue;
  if (json.Monto !== undefined) {
    const amount = cleanCurrency(json.Monto);
    let type = String(json.Tipo || '').trim().toUpperCase();
    let concept = String(json.Concepto || '').trim().toUpperCase();
    
    if (concept.includes('ADS') || concept.includes('PUBLICIDAD') || type.includes('PUBLICIDAD')) {
       type = 'Publicidad';
    } else if (type.includes('COMPRA')) {
       type = 'Compra';
    } else {
       type = 'Venta';
    }
    
    business.transactions.push({
      date: json.Fecha || '-',
      item: json.Concepto || '-',
      type: type,
      amount: amount
    });
  }
}

return [{ json: { business } }];
