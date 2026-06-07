#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

async function runMigration(migrationFile) {
  try {
    console.log(`📦 Running migration: ${migrationFile}`);

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql', migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://jmnjkxfxenrudpvjprcu.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
      process.exit(1);
    }

    console.log(`✓ Supabase URL: ${supabaseUrl}`);

    // Execute via Supabase API
    const url = new URL(`${supabaseUrl}/rest/v1/rpc/query_raw`);

    const postData = JSON.stringify({ query: sql });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      }
    };

    console.log(`⏳ Sending migration to Supabase...`);

    const response = await new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (response.status === 200 || response.status === 201) {
      console.log(`✅ Migration completed: ${migrationFile}`);
    } else if (response.status === 404) {
      console.warn(`⚠️  Supabase query_raw RPC not available. Please run the SQL manually in the Supabase dashboard:`);
      console.warn(`\n📋 SQL to execute:\n`);
      console.log(sql);
      console.warn(`\n📍 Go to: ${supabaseUrl}/project/sql to execute the SQL above`);
    } else {
      throw new Error(`Supabase API error: ${response.status} - ${response.body}`);
    }
  } catch (error) {
    console.error(`❌ Migration error:`, error.message);

    // Fall back to showing SQL for manual execution
    try {
      const sqlPath = path.join(__dirname, '../sql', process.argv[2] || 'add_comprehensive_audit_trail.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.error(`\n📋 Execute this SQL manually in Supabase dashboard:\n`);
      console.error(sql);
    } catch (e) {
      // Ignore if we can't read the file
    }

    process.exit(1);
  }
}

// Run migration
const migrationFile = process.argv[2] || 'add_comprehensive_audit_trail.sql';
runMigration(migrationFile);
