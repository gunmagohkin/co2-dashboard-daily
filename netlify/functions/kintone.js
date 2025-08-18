// netlify/functions/kintone.js

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event) {
  console.log("Function started");

  try {
    const domain = process.env.KINTONE_DOMAIN;
    const appId = process.env.KINTONE_APP_ID;
    const token = process.env.KINTONE_API_TOKEN;

    // Get month and year from query params
    const params = event.queryStringParameters || {};
    const month = params.month;
    const year = params.year;
    const category = params.category;

    let query = '';
    if (month && year && month !== 'All') {
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      query = `Date_Today >= "${year}-${month}-01" and Date_Today <= "${year}-${month}-${String(lastDay).padStart(2, '0')}"`;
    } else if (year) {
      // Query for all records in the selected year
      query = `Date_Today >= "${year}-01-01" and Date_Today <= "${year}-12-31"`;
    }
    // Encode query for URL
    const queryParam = query ? `&query=${encodeURIComponent(query)}` : '';

    if (category) {
      if (query) query += ' and ';
      query += `Consumption_Category = "${category}"`;
    }

    const url = `https://${domain}/k/v1/records.json?app=${appId}${queryParam}`;
    console.log("Fetching from:", url);

    const res = await fetch(url, {
      headers: {
        "X-Cybozu-API-Token": token
      }
    });

    const text = await res.text();
    console.log("Response text:", text);

    if (!res.ok) {
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

    console.log("Records received:", data.records?.length);

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
