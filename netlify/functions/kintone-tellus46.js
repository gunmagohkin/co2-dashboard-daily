const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const domain = process.env.KINTONE_DOMAIN;
const appId = process.env.KINTONE_APP_ID;
const token = process.env.KINTONE_API_TOKEN;

const KINTONE_BASE_URL = `https://${domain}/k/v1/records.json`;
const KINTONE_APP_ID = appId;
const KINTONE_API_TOKEN = token;

exports.handler = async function(event, context) {
  // Correct field code for filtering
  const query = `Consumption_Category in ("Hydraulic Oil")`;
  const url = `${KINTONE_BASE_URL}?app=${KINTONE_APP_ID}&query=${encodeURIComponent(query)}`;

  console.log('Kintone URL:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'X-Cybozu-API-Token': KINTONE_API_TOKEN
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Kintone error response:', errorText);
      return {
        statusCode: response.status,
        body: errorText
      };
    }

    const data = await response.json();
    console.log('Total Kintone records fetched:', (data.records || []).length);
    const records = data.records || [];

    let tellusRows = [];
    records.forEach(record => {
      if (record.Hydraulic_Oil && Array.isArray(record.Hydraulic_Oil.value)) {
        record.Hydraulic_Oil.value.forEach(sub => {
          if (sub.value.Tellus?.value === "Tellus 46") {
            tellusRows.push(sub.value);
          }
        });
      }
    });

    console.log('Total Tellus 46 rows:', tellusRows.length);

    return {
      statusCode: 200,
      body: JSON.stringify({ rows: tellusRows })
    };
  } catch (err) {
    console.log('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
//last working version
// This function fetches Tellus 46 refill data from Kintone for a specific month and year
// and returns it in a format suitable for rendering in a dashboard.