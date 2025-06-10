const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getQualifiedLeads(filters = {}) {
    const { limit = 10, company, latest, date } = filters;
  
    let query = supabase
      .from('qualifiedCommentators')
      .select('userName, companyName, reason, created_at');
  
    if (latest) {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('id', { ascending: false });
    }
  
    if (company) {
      query = query.ilike('companyName', `%${company}%`);
    }
  
    if (date) {
      query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
    }
  
    if (limit) {
      query = query.limit(limit);
    }
  
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

async function getDisqualifiedLeads(filters = {}) {
    
    const {limit = 10, company, status, latest, date} = filters

    let query = supabase
    .from('qualifications')
    .select('userName, status, companyName, created_at, qualificationReason');

    if (latest) {
        query = query.order('created_at', { ascending: false });
    } 





}

module.exports = {
  getQualifiedLeads,
  // you can add more functions here later
};