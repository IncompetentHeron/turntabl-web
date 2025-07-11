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
    const { album } = await req.json();

    if (!album) {
      throw new Error('Missing album data in request body');
    }

    // Validate required fields
    const requiredFields = ['id', 'name', 'artist', 'artistId', 'coverUrl', 'releaseDate', 'type'];
    const missingFields = requiredFields.filter(field => !album[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Test database connection
    const { error: testError } = await supabaseAdmin
      .from('albums')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      throw new Error('Database connection failed');
    }

    // Attempt to upsert album
    const { data, error } = await supabaseAdmin
      .from('albums')
      .upsert({
        id: album.id,
        name: album.name,
        artist: album.artist,
        artist_id: album.artistId,
        cover_url: album.coverUrl,
        release_date: album.releaseDate,
        album_type: album.type,
        popularity: album.popularity || 0,
        spotify_url: album.spotifyUrl,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting album:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Album synced successfully',
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
    console.error('Error in sync-album function:', {
      message: error.message,
      details: error.details,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync album',
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