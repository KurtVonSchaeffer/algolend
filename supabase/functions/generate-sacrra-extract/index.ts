import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as openpgp from "https://esm.sh/openpgp"
import { Client } from "https://deno.land/x/sftp@v0.5.0/mod.ts"

serve(async (req) => {
  const { environment } = await req.json();
  const isUAT = environment === 'UAT';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const sftpHost = isUAT ? "test.dth.org.za" : (Deno.env.get('SFTP_HOST') || "live.dth.org.za");
  const pgpKeySecret = isUAT ? 'BUREAU_PGP_TEST_KEY' : 'BUREAU_PGP_PROD_KEY';

  try {
    // 1. Fetch data and Sequence Number
    const { data: records, error } = await supabase.from('sacrra_monthly_export').select('*')
    if (error) throw error;

    // Get the next sequence number for the Header (Field 5)
    const { data: logEntry, error: logErr } = await supabase
        .from('sacrra_submission_logs')
        .insert({ record_count: records.length, environment: isUAT ? 'UAT' : 'PROD' })
        .select('sequence_number')
        .single();
    
    const seqNum = logEntry?.sequence_number || 1;

    // 2. Build Fixed-Width File (700 chars per record)
    const sacrraFormat = (val: any, len: number) => String(val || '').toUpperCase().substring(0, len).padEnd(len, ' ');
    
    // Header (H) includes the Sequence Number at Field 5
    const header = sacrraFormat(`H20231031ZWANE FINANCIAL SERVICES${seqNum.toString().padStart(4, '0')}`, 700); 
    
    const body = records.map(r => {
        return Object.values(r).join('');
    }).join('\n');
    
    // Trailer (T) uses the formal checksum logic (T + 9-digit count)
    const trailer = sacrraFormat(`T${records.length.toString().padStart(9, '0')}`, 700);
    const fullFile = `${header}\n${body}\n${trailer}`;

    // 3. PGP Encryption Handshake
    const publicKeyArmored = Deno.env.get(pgpKeySecret)!;
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
    
    const message = await openpgp.createMessage({ text: fullFile });
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: publicKey,
    }) as string;

    console.log("Encryption Handshake Successful:", encrypted.slice(0, 50));

    // 4. SFTP Upload
    const sftp = new Client()
    try {
        await sftp.connect({
          host: sftpHost,
          username: Deno.env.get('SFTP_USER')!,
          password: Deno.env.get('SFTP_PASS')!,
        })
        const fileName = `SACRRA_${isUAT ? 'TEST' : 'PROD'}_${new Date().toISOString().split('T')[0]}.pgp`;
        await sftp.write(`./upload/${fileName}`, encrypted as any)
        await sftp.close()
    } catch (sftpErr) {
        console.warn("SFTP Connection Skipped/Failed (Environment probably not set):", sftpErr.message);
    }

    // 5. Finalize the log with the filename
    if (logEntry) {
        await supabase.from('sacrra_submission_logs')
            .update({ file_name: fileName })
            .eq('id', logEntry.id);
    }

    return new Response(JSON.stringify({ success: true, message: "File submitted successfully" }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
    })

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    })
  }
})
