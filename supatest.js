const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ysejulbuvunfhodersjr.supabase.co', 'sb_publishable_nn7GsENQXU_YmbYO7S8bUA_s8P4SVW5');

async function run() {
  const roomData = {
      title: 'Debug Room',
      room_number: '000',
      description: 'Test description',
      type: 'Single',
      pricePerNight: 100,
      roomCount: 1,
      view: 'Ocean',
      status: 'available',
      imageUrl: 'https://example.com/test.jpg'
  };
  console.log('Attempting insert with:', roomData);
  const { data, error } = await supabase.from('rooms').insert([roomData]);
  if (error) {
    console.error('SUPABASE ERROR:', JSON.stringify(error, null, 2));
    console.error('Raw error object:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}
run();
