// netlify/functions/kintone.js

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event) {
  console.log("Function started");

  try {
    const domain = process.env.KINTONE_DOMAIN;
    const appId = process.env.KINTONE_APP_ID;
    const token = process.env.KINTONE_API_TOKEN;

    // Get month/year/category from query params
    const { month, year, category } = event.queryStringParameters || {};

    let query = '';

    if (month && year && month !== 'All') {
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      query = `Date_Today >= "${year}-${month}-01" and Date_Today <= "${year}-${month}-${String(lastDay).padStart(2, '0')}"`;
    } else if (year) {
      query = `Date_Today >= "${year}-01-01" and Date_Today <= "${year}-12-31"`;
    }

    if (category) {
      if (query) query += ' and ';
      query += `Consumption_Category in ("${category}")`;
    }

    console.log("Final query:", query);

    // Pagination variables
    let allRecords = [];
    let offset = 0;
    const limit = 500;

    while (true) {
      const url = `https://${domain}/k/v1/records.json?app=${appId}&query=${encodeURIComponent(query + ` order by Date_Today asc limit ${limit} offset ${offset}`)}`;

      console.log(`Fetching batch: offset=${offset}, limit=${limit}`);

      const res = await fetch(url, {
        headers: {
          "X-Cybozu-API-Token": token
        }
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("Error response:", text);
        return {
          statusCode: res.status,
          body: text
        };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("Failed to parse JSON:", parseErr);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Invalid JSON returned from Kintone" })
        };
      }

      const records = data.records || [];
      allRecords = allRecords.concat(records);

      console.log(`Fetched ${records.length} records (total so far: ${allRecords.length})`);

      if (records.length < limit) {
        break; // no more records
      }

      offset += limit;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ records: allRecords })
    };

  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
