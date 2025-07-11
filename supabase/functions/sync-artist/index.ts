import { createClient } from 'npm:@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      });
      throw new Error('Missing required environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body first to fail fast if invalid
    const { artist } = await req.json();

    if (!artist) {
      throw new Error('Missing artist data in request body');
    }

    // Validate required fields
    const requiredFields = ['id', 'name'];
    const missingFields = requiredFields.filter(field => !artist[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Test database connection
    const { error: testError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      throw new Error('Database connection failed');
    }

    // Attempt to upsert artist
    const { data, error } = await supabaseAdmin
      .from('artists')
      .upsert({
        id: artist.id,
        name: artist.name,
        image_url: artist.imageUrl,
        spotify_url: artist.spotifyUrl,
        genres: artist.genres || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting artist:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Artist synced successfully',
        data 
      }), 
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    );
  } catch (error) {
    console.error('Error in sync-artist function:', {
      message: error.message,
      details: error.details,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync artist',
        details: error.details || null
      }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    );
  }
});