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
      throw new Error('Missing required environment variables.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { content, actor_id, reference_type, reference_id } = await req.json();

    if (!content || !actor_id || !reference_type || !reference_id) {
      throw new Error('Missing required parameters: content, actor_id, reference_type, reference_id');
    }

    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    let match;
    const mentionedUsernames = new Set<string>();

    while ((match = mentionRegex.exec(content)) !== null) {
      mentionedUsernames.add(match[1]);
    }

    if (mentionedUsernames.size === 0) {
      return new Response(JSON.stringify({ message: 'No mentions found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('username', Array.from(mentionedUsernames));

    if (profileError) throw profileError;

    const notificationsToInsert = profiles
      .filter(profile => profile.id !== actor_id) // Prevent self-mention notifications
      .map(profile => ({
        user_id: profile.id,
        type: 'mention',
        actor_id: actor_id,
        reference_type: reference_type,
        reference_id: reference_id,
      }));

    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ message: 'Mention notifications created successfully.', count: notificationsToInsert.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in create-mention-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create mention notifications' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
