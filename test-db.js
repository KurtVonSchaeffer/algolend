const { supabase } = require('./config/supabaseServer.js');
async function test() {
  const { data: loans, error: loansErr } = await supabase.from('loans').select('*').limit(1);
  const { data: settings, error: settingsErr } = await supabase.from('system_settings').select('*').limit(1);
  console.log("Loans:", loansErr ? loansErr.message : loans);
  console.log("Settings:", settingsErr ? settingsErr.message : settings);
}
test();
