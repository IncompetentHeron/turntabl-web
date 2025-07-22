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

    const { reported_content_type, reported_content_id, reason } = await req.json();

    // Get the user ID from the request's auth token
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Authentication token missing.');
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid authentication token or user not found.');
    }
    const reported_by_user_id = user.id;

    // Insert into moderation_reports table
    const { error: reportError } = await supabaseAdmin
      .from('moderation_reports')
      .insert({
        reported_by_user_id,
        reported_content_type,
        reported_content_id,
        reason,
        status: 'pending',
      });

    if (reportError) {
      console.error('Error inserting moderation report:', reportError);
      throw reportError;
    }

    // Update moderation_status of the reported content
    let updateError;
    if (reported_content_type === 'review') {
      const { error } = await supabaseAdmin
        .from('reviews')
        .update({ moderation_status: 'pending_review' })
        .eq('id', reported_content_id);
      updateError = error;
    } else if (reported_content_type === 'comment') {
      const { error } = await supabaseAdmin
        .from('review_comments')
        .update({ moderation_status: 'pending_review' })
        .eq('id', reported_content_id);
      updateError = error;
    } else {
      throw new Error('Invalid reported_content_type.');
    }

    if (updateError) {
      console.error(`Error updating ${reported_content_type} moderation status:`, updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ message: 'Content reported successfully and status updated.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in report-content function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to report content' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
