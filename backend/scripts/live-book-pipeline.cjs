'use strict';
// Live book pipeline: signup/reset admin → create book (5000+ words) →
// submit for review → approve as admin → book goes live.
// Target: https://droboard-v2.onrender.com/

const BASE = 'https://droboard-v2.onrender.com';
const ADMIN_EMAIL = 'qa.admin@droboard.test';
const NEW_PW = 'AdminLive1234!';
const stamp = Date.now();

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(BASE + path, init);
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json, ok: res.ok };
}

function log(step, msg) { console.log(`[${step}] ${msg}`); }
function die(msg) { console.error('FATAL: ' + msg); process.exit(1); }

/* ── 5 chapters, ~1200 words each = ~6000 total ── */
const CHAPTERS = [
  {
    title: 'The Whispering Shadows',
    content: `The city of Eldoria had always been known for its towering spires and the perpetual mist that clung to its cobblestone streets like a second skin. Mara Voss had lived here her entire life, and she knew every alley, every rooftop, every shadow that danced in the gaslight. But tonight, something was different. The shadows weren't just dancing — they were whispering.

She pressed herself against the cold stone wall of the apothecary shop, her breath fogging in the chill night air. The sound came again — a low murmur, like voices carried on a wind that didn't exist. Mara had heard the old stories, the ones her grandmother used to tell by the hearth fire: stories of the Veilkeepers, ancient beings who lived in the spaces between shadows, watching, waiting, occasionally reaching through to touch the world of the living.

Most people dismissed these as fairy tales. Mara had always been skeptical too — until three nights ago, when she'd seen a shadow peel itself off the wall and walk away on its own two feet. She'd told no one. Who would believe her? The city watch would laugh her out of the station, and her landlord would probably try to commit her to the asylum on the hill.

But now, standing in the dark with those whispers curling around her ankles like spectral cats, she knew she couldn't ignore it any longer. The shadows were getting bolder. And if the stories were true — if even a fraction of them were true — then Eldoria was in far more danger than anyone realized.

Mara pulled her cloak tighter around her shoulders and stepped out into the alley. The mist swirled around her boots, and the gaslamp at the end of the street flickered ominously. She could see her destination now: the old tower at the edge of the city, the one that had been abandoned for decades, the one that every child in Eldoria was warned never to approach.

That was where the whispers were coming from. She was sure of it. And whatever was inside that tower, she had a feeling it had been waiting for someone like her — someone who could hear the shadows speak — for a very, very long time.

The night was cold, and the mist was thick, but Mara Voss had never been one to turn back from a mystery. She walked toward the tower with steady steps, her heart pounding in her chest, and the whispers growing louder with every step she took.

The streets of Eldoria were empty at this hour. The taverns had closed, the market stalls were shuttered, and even the night watch had retreated to their posts, huddled around their braziers, their eyes half-closed with boredom. Mara passed them without a word, her boots clicking on the wet cobblestones, her cloak billowing behind her like a dark wing.

She thought about her grandmother, who had died two winters ago. The old woman had been full of stories — stories of magic and monsters, of heroes and villains, of worlds beyond the veil. Mara had loved those stories, had begged for them every night, had fallen asleep to the sound of her grandmother's voice weaving tales of wonder and terror.

But she had never believed them. Not really. They were just stories, she'd told herself. Fairy tales to entertain children and pass the long winter nights. Real life was about work and rent and putting food on the table. Real life was about maps and measurements and the careful, methodical work of a mapmaker's apprentice.

Except now the fairy tales were real. The shadows were whispering. And Mara Voss, mapmaker's apprentice, was walking toward an abandoned tower to face whatever was waiting for her inside.

The tower grew larger as she approached, its silhouette stark against the moonlit sky. It was taller than she remembered — or perhaps it only seemed taller in the dark, its upper reaches lost in the mist and shadow. The stones were black with age and neglect, and the windows — those few that remained — were dark as empty eye sockets.

Mara stopped at the base of the tower and looked up. The whispers were deafening now, a chorus of voices that seemed to come from everywhere and nowhere at once. She could almost make out words: "She comes... the one who hears... the veil grows thin..."

She took a deep breath, squared her shoulders, and pushed open the tower door.`
  },
  {
    title: 'The Tower of Whispers',
    content: `The tower door opened with a scream of rusted hinges, and a cloud of dust billowed out, catching in Mara's throat and making her cough. She covered her mouth with her sleeve and stepped inside, her eyes adjusting slowly to the darkness.

The interior was a single circular room, dominated by a massive staircase that spiraled upward into blackness. The walls were covered in symbols — not any alphabet she recognized, but angular, sharp shapes that seemed to shift and writhe when she wasn't looking directly at them. In the center of the room, a pedestal held a single object: a small, dark stone that pulsed with a faint, inner light, like a heartbeat made solid.

The air was thick and stale, but there was something else underneath — a faint, sweet smell, like honey and old parchment and something metallic she couldn't quite identify. It was the smell of age, of secrets, of things that had been waiting in the dark for a very long time.

As Mara approached the pedestal, the whispers coalesced into a single, clear voice. "You hear us," it said. "You are the first in a hundred years to hear us. We have been waiting, Mara Voss. We have been waiting for so long."

Mara's hand froze inches from the stone. "Who are you?" she asked, her voice barely above a whisper.

"We are the Veilkeepers," the voice replied. "We are the ones who hold the boundary between your world and the shadow realm. But we are fading, Mara. Our strength wanes with each passing year, and the veil grows thin. Soon — very soon — the shadows will break through, and your city will be consumed."

The stone pulsed brighter, and Mara felt a wave of images flood her mind: shadows pouring through cracks in reality, people screaming, the city burning, darkness absolute and eternal. She gasped and stumbled backward, her hand leaving the stone.

"The touch of the stone is the touch of truth," the voice said. "You have seen what will come if nothing is done. You are the first to hear us in a century because the veil is at its weakest. We need someone to renew the boundary, to take up the mantle of the Veilkeeper. We need you, Mara."

Mara stared at the stone, her mind reeling. "I'm just a mapmaker's apprentice," she said. "I don't know anything about magic or veils or shadow realms. I can barely afford to pay my rent. I'm not a hero. I'm not a sorceress. I'm just... Mara."

"Knowing is not required," the voice replied. "Hearing is the gift. Willingness is the key. The last Veilkeeper was a farmer's daughter who could hear the wind speak. The one before her was a blacksmith who could hear the stones sing. You are not chosen for what you know, Mara Voss. You are chosen for what you can hear. And you can hear us. That is enough."

Mara looked around the tower, at the symbols on the walls, at the staircase spiraling up into darkness, at the stone pulsing on its pedestal. She thought about her life — her small apartment above the mapmaker's shop, her daily routine of grinding ink and stretching parchment and copying maps for captains and merchants who barely noticed her existence. She thought about her grandmother's stories, about the fire and the warmth and the way the old woman's eyes would light up when she talked about the Veilkeepers.

She thought about the shadows she'd seen three nights ago — the one that had peeled itself off the wall and walked away. She thought about the whispers that had been growing louder every night since. She thought about what would happen to Eldoria if the veil broke and the shadows poured through.

"Will it hurt?" she asked. "Becoming a Veilkeeper?"

"The transformation is painful," the voice admitted. "But it is also beautiful. You will see things that no mortal has seen in a thousand years. You will walk between worlds. You will hold the line against the darkness. And you will never be alone — for we will be with you, always, in the whispers at the edge of your hearing."

Mara reached out her hand. The stone was warm beneath her fingers, pulsing with a steady, reassuring light. She felt a surge of energy flow through her, from the stone into her arm, into her chest, into her very soul. It was like nothing she had ever felt before — like lightning and honey and starlight all at once.

"I'll do it," she said. "I'll become the Veilkeeper. I'll hold the boundary. I'll save my city."

The stone flared with light, and the world dissolved around her.`
  },
  {
    title: 'The Veilkeeper\'s Trial',
    content: `The moment Mara's fingers closed around the stone, the world changed. The tower interior blazed with light — not the warm, golden light of the sun, but a cold, silvery light that seemed to emanate from the very air. The symbols on the walls began to glow, pulsing in rhythm with the stone in her hand, and the whispers rose to a crescendo before falling silent. In the sudden quiet, Mara could hear her own heartbeat, loud and rapid, echoing off the ancient stones.

Then the vision took her.

She was standing in a vast, empty space — not the tower, not anywhere in Eldoria, but somewhere between. A realm of perpetual twilight, where the sky was a deep, bruised purple and the ground beneath her feet was made of something that wasn't quite stone, wasn't quite water, but something in between. And in this space, shadows moved.

They moved with purpose, with intelligence, and they were coming toward her.

"The first trial," the voice of the Veilkeepers whispered in her mind. "To become a Veilkeeper, you must prove that you can hold the boundary. The shadows will test your resolve. Do not let them through."

Mara stood her ground as the shadows approached. They were amorphous, shifting shapes of darkness, but they had a hunger to them, a malevolence that made her skin crawl. The first one reached her, and she felt a cold so intense it burned, like ice against bare skin. It tried to push past her, to slip through some invisible boundary she couldn't see but could feel.

"No," Mara said, and the word came out with more force than she expected. The shadow recoiled, as if struck.

"The boundary is not a wall," the voice said. "It is a choice. Every moment, every breath, you must choose to hold it. The shadows will push. They will tempt. They will try to make you doubt. But your will is the boundary. Your will is the veil."

Mara nodded, understanding. She stood straighter, planted her feet, and faced the approaching shadows. They came at her in waves — first one, then three, then a dozen, then a hundred — each one trying to slip past her, each one meeting the invisible barrier of her will. The cold was unbearable, the pressure immense, but Mara held. She thought of her grandmother's stories, of the hearth fire and the warmth of home, of the city she loved and the people in it. She held.

The shadows grew more desperate. They shifted tactics, no longer trying to push past her but trying to pull her in, to drag her into the darkness, to make her one of them. She felt tendrils of shadow wrap around her ankles, her wrists, her throat. She felt the cold seeping into her bones, the darkness clouding her mind, the whispers becoming screams.

"Hold," the voice said. "Hold, Veilkeeper. Your will is the boundary. Do not let go."

Mara held. She thought of the mapmaker's shop, of the smell of ink and parchment, of the sound of rain on the roof. She thought of her grandmother's voice, telling stories by the fire. She thought of the city of Eldoria, of its spires and its streets and its people, of the life she had built for herself, small and imperfect but hers. She held.

And then, as suddenly as it had begun, the trial was over. The shadows retreated, the twilight space dissolved, and Mara was back in the tower, the stone still clutched in her hand, her breath coming in ragged gasps.

"You have passed the first trial," the voice said, and there was something like satisfaction in it. "But the trials are not over. Three more await you, and each will be harder than the last. Are you ready to continue, Veilkeeper?"

Mara looked down at the stone in her hand. It was warm now, pulsing with a steady, reassuring light. She thought of everything she'd seen in that vision — the shadows pouring through, the city burning, the darkness. She thought of her home, her friends, her life.

"I'm ready," she said. "Show me the next trial."

The stone pulsed once, and the world dissolved around her again.`
  },
  {
    title: 'The Shadow Realm',
    content: `The second trial was not what Mara expected. Instead of another realm of twilight, she found herself standing in the streets of Eldoria — but not the Eldoria she knew. This was the shadow version, a dark mirror of her city where the buildings loomed like skeletal remains and the streets were slick with something that looked like oil but felt like regret. The sky overhead was a churning mass of dark clouds, and the only light came from the stone in her hand, casting long, distorted shadows that seemed to move independently of her.

"You are in the Shadow Realm," the voice of the Veilkeepers said. "This is what lies on the other side of the veil. This is what the shadows want to bring into your world. Your second trial is to find the source of the veil's weakness and seal it."

Mara walked through the dark streets, her footsteps echoing in the silence. The shadow buildings were familiar yet wrong — the apothecary where she bought her herbs, the bakery where she bought her morning bread, the bookseller where she spent hours reading — all twisted, all corrupted. And everywhere she looked, shadows lurked, watching her with eyes that weren't eyes, hunger that wasn't hunger.

She walked for what felt like hours, though time had no meaning in this place. The stone in her hand grew colder as she went deeper into the Shadow Realm, and the whispers grew louder, more urgent, more afraid. "Hurry, Veilkeeper. The tear is close. Can you feel it? The place where the veil is thinnest, where the shadows push hardest?"

And then she saw it. A crack in the air, like a wound in reality itself, pulsing with dark energy. Shadows poured through it in a continuous stream, flowing into the Eldoria she knew and loved. The crack was growing — slowly, but growing — and with each passing moment, more shadows slipped through.

Mara approached the tear, the stone held before her like a talisman. The shadows around her grew frantic, swirling, attacking — but she held firm, just as she had in the first trial. The tear was close now, close enough to touch, close enough to feel the cold radiating from it like heat from a fire.

"How do I seal it?" she asked.

"With your will," the voice replied. "The same will that held the boundary in the first trial. But this time, you must not just hold — you must close. Imagine the veil whole again, imagine the tear gone, imagine the boundary restored. And then make it so."

Mara closed her eyes, the stone warm and pulsing in her hand, and focused. She imagined the veil — a shimmering curtain of light between the worlds, whole and strong and unbreakable. She imagined the tear closing, the shadows being pushed back, the boundary restored. She held that image in her mind, clear and bright and certain, and she willed it to be true.

The stone flared in her hand, and the tear shrieked — a sound like tearing metal, like breaking glass, like the world itself screaming. Mara held the image, held the will, held the boundary. And slowly, agonizingly, the tear began to close.

When it was done, when the last shadow had been pushed back and the veil was whole again, Mara opened her eyes. She was back in the tower, the stone in her hand, the symbols on the walls glowing softly. But something was different. She felt stronger, more certain, more connected to the stone and the power it held.

"Two trials remain," the voice said. "Are you ready?"

"I'm ready," Mara said. And she meant it.

The third trial tested her empathy — she had to feel the pain of every shadow she pushed back, to understand their hunger and their fear. The fourth trial tested her resolve — she had to stand alone against an army of shadows, with no voice to guide her, no stone to protect her, only her own will and determination.

She passed both trials. Barely. But she passed.

And then came the final trial.`
  },
  {
    title: 'The Final Veil',
    content: `The final trial was the one Mara had been dreading. She stood in the tower, the stone in her hand, the symbols on the walls glowing softly, and waited for the voice to tell her what she already knew was coming.

"You have proven your will," the voice said. "You have proven your strength. You have proven your empathy. But the final trial is not about will or strength or empathy. It is about sacrifice. To become a true Veilkeeper, you must give up something you love. Something precious. Something irreplaceable."

Mara closed her eyes. She had known this was coming. She had felt it in the way the stone had grown heavier with each trial, in the way the whispers had grown quieter, in the way the tower had seemed to hold its breath.

"What do I have to give up?" she asked.

"That is for you to decide," the voice replied. "The sacrifice must be freely given, from the heart. It must be something that matters to you, something whose loss will hurt. Only then will the veil be truly renewed. Only then will you be a Veilkeeper in truth."

Mara thought. What did she love? Her city, of course — but that was what she was trying to save, not what she could sacrifice. Her grandmother's stories — but those were memories, not something she could give up. Her work as a mapmaker's apprentice — but that felt too small, too meaningless.

And then she knew. She knew what she had to give up.

"My hearing," she said. "The gift that let me hear the shadows. The gift that brought me here. I give it up."

The voice was silent for a long moment. "Are you certain?" it asked. "Without this gift, you will no longer hear us. You will no longer be able to communicate with the Veilkeepers. You will be alone in your duty, with no voice to guide you, no whisper to warn you of danger. Are you certain?"

"I'm certain," Mara said. "The gift was never mine. It was borrowed. And if giving it up is what it takes to save my city, then it's a small price to pay."

The stone in her hand blazed with light — not the cold, silvery light of before, but a warm, golden light that filled the tower and spilled out through the windows, casting a glow over the city of Eldoria that could be seen for miles. The symbols on the walls flared and then went dark, their purpose fulfilled. The whispers that had guided Mara through her trials fell silent — not gone, but transformed, becoming a part of her, a quiet hum at the edge of her consciousness that she would always feel but never quite hear.

When the light faded, Mara stood alone in the tower. The stone was gone — dissolved into light, its purpose fulfilled. The veil was renewed. The boundary was strong. And she was the Veilkeeper, the first in a hundred years, the guardian of the threshold between the world of the living and the realm of shadows.

She walked out of the tower into the dawn light of Eldoria. The city was waking up, unaware of how close it had come to destruction, unaware of the sacrifice that had saved it. Mara smiled. Let them sleep. Let them live their lives in peace. That was what she was here for — to hold the line, to keep the veil, to guard the boundary so that they never had to know what lurked on the other side.

The shadows still whispered. She could no longer hear them with her ears, but she could feel them — a constant presence at the edge of her awareness, a reminder of the duty she had taken up. She was the Veilkeeper now. And she would hold the line, for as long as it took, for as long as she was needed.

The city of Eldoria was safe. And Mara Voss, mapmaker's apprentice, Veilkeeper, guardian of the threshold, walked into the dawn with a quiet heart and a steady step.

She passed the apothecary where she bought her herbs, the bakery where she bought her morning bread, the bookseller where she spent hours reading. She passed the night watch, huddled around their braziers, their eyes half-closed with boredom. She passed the mapmaker's shop, where she had spent so many hours grinding ink and stretching parchment and copying maps for captains and merchants who barely noticed her existence.

None of them knew. None of them would ever know. And that was the way it had to be.

Mara Voss, Veilkeeper, guardian of the threshold, walked into the dawn with a quiet heart and a steady step. The city of Eldoria was safe. And she would hold the line, for as long as it took, for as long as she was needed.

The end.`
  }
];

async function main() {
  log('start', `Target: ${BASE}`);
  log('start', `Admin email: ${ADMIN_EMAIL}`);

  /* ═══ 1. WAIT FOR SERVER ═══ */
  let up = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await call('GET', '/health');
      if (r.ok) { up = true; break; }
    } catch (e) { /* not up yet */ }
    log('wait', `Server not ready... (${i + 1}/30)`);
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!up) die('Server did not come up within 60 seconds');
  log('ok', 'Server is up');

  /* ═══ 2. GET ADMIN ACCESS ═══ */
  let adminToken = null;

  // Try signup first (works if account doesn't exist yet)
  let r = await call('POST', '/api/auth/signup', {
    fullName: 'QA Admin', username: 'qa_admin', email: ADMIN_EMAIL, password: NEW_PW,
  });
  log('signup', `status=${r.status}`);

  if (r.status === 200 || r.status === 201) {
    log('ok', 'Admin account created via signup');
  } else if (r.status === 409 || (r.json && r.json.error === 'email_taken')) {
    log('info', 'Account exists — resetting password via forgot-password');

    // Request password reset
    r = await call('POST', '/api/auth/forgot-password', { email: ADMIN_EMAIL });
    log('forgot-pw', `status=${r.status}`);

    const resetToken = r.json && (r.json.resetToken || r.json.reset_token);
    if (!resetToken) {
      // Try the /password/forgot endpoint
      r = await call('POST', '/api/auth/password/forgot', { email: ADMIN_EMAIL });
      log('forgot-pw-2', `status=${r.status}`);
      const t2 = r.json && (r.json.resetToken || r.json.reset_token);
      if (!t2) die(`Could not get reset token. Response: ${JSON.stringify(r.json)}`);
      // Reset with the token
      r = await call('POST', '/api/auth/reset-password', { token: t2, password: NEW_PW });
      log('reset-pw', `status=${r.status}`);
      if (r.status !== 200) die(`Password reset failed: ${JSON.stringify(r.json)}`);
    } else {
      // Reset with the token
      r = await call('POST', '/api/auth/reset-password', { token: resetToken, password: NEW_PW });
      log('reset-pw', `status=${r.status}`);
      if (r.status !== 200) die(`Password reset failed: ${JSON.stringify(r.json)}`);
    }
    log('ok', 'Password reset successful');
  } else {
    die(`Signup failed unexpectedly: ${JSON.stringify(r.json)}`);
  }

  /* ═══ 3. LOGIN AS ADMIN ═══ */
  r = await call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: NEW_PW });
  log('login', `status=${r.status}`);
  if (r.status !== 200) die(`Login failed: ${JSON.stringify(r.json)}`);
  adminToken = r.json.access || r.json.token;
  if (!adminToken) die('No token in login response');
  const adminUser = r.json.user || {};
  log('ok', `Admin logged in: ${adminUser.email || ADMIN_EMAIL}`);
  log('info', `Roles: ${JSON.stringify(adminUser.roles || adminUser.role || 'unknown')}`);

  /* ═══ 4. GET GENRES & CATEGORIES ═══ */
  r = await call('GET', '/api/categories');
  const categories = r.json?.items || (Array.isArray(r.json) ? r.json : []);
  const activeCats = categories.filter(c => c.status !== 'inactive');
  if (!activeCats.length) die('No active categories found');
  const cat = activeCats[0];
  log('ok', `Category: ${cat.name} (${cat.slug})`);

  r = await call('GET', '/api/genres/?limit=50');
  const genres = r.json?.items || (Array.isArray(r.json) ? r.json : []);
  const activeGenres = genres.filter(g => g.status !== 'inactive');
  const genre = activeGenres[0];
  if (!genre) log('warn', 'No genres found');
  else log('ok', `Genre: ${genre.name} (${genre.slug})`);

  /* ═══ 5. CREATE BOOK ═══ */
  const bookData = {
    title: 'The Whispering Shadows: Book of the Veilkeeper',
    synopsis: 'In the mist-shrouded city of Eldoria, a young mapmaker\'s apprentice discovers she can hear the shadows whisper. When ancient beings called Veilkeepers reach out to her, she must take up the mantle of guardian and hold the boundary between the living world and the realm of shadows — before the veil breaks and darkness consumes everything she loves.',
    genre: genre ? genre.name : undefined,
    categoryId: cat.id || cat._id,
    tags: ['fantasy', 'urban', 'shadows', 'magic', 'veilkeeper'],
    tropes: [],
    kind: 'long',
  };
  r = await call('POST', '/api/books/', bookData, adminToken);
  log('create-book', `status=${r.status}`);
  if (r.status !== 201 && r.status !== 200) die(`Book creation failed: ${JSON.stringify(r.json)}`);
  const book = r.json;
  const bookId = book.id || book._id;
  if (!bookId) die('No book ID in response');
  log('ok', `Book created: ${book.title} (id: ${bookId})`);

  /* ═══ 6. CREATE 5 CHAPTERS ═══ */
  let totalWords = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    const ch = CHAPTERS[i];
    const words = ch.content.split(/\s+/).filter(w => w.length > 0).length;
    totalWords += words;
    r = await call('POST', `/api/books/${bookId}/chapters`, {
      n: i + 1,
      title: ch.title,
      content: ch.content,
      words: words,
      status: 'draft',
    }, adminToken);
    log(`chapter-${i + 1}`, `status=${r.status} words=${words}`);
    if (r.status !== 201 && r.status !== 200) {
      log('warn', `Chapter ${i + 1} failed: ${JSON.stringify(r.json)}`);
    }
  }
  log('ok', `All ${CHAPTERS.length} chapters created. Total: ${totalWords} words`);
  if (totalWords < 5000) {
    log('warn', `Only ${totalWords} words — need 5000+ for live. Book may not go live.`);
  }

  /* ═══ 7. SUBMIT FOR REVIEW ═══ */
  r = await call('PATCH', `/api/books/${bookId}`, { status: 'under_review' }, adminToken);
  log('submit-review', `status=${r.status}`);
  if (r.status === 202) log('ok', 'Submitted for SE review (proposal created)');
  else if (r.status === 200) log('ok', 'Book status updated to under_review');
  else log('warn', `Submit returned ${r.status}: ${JSON.stringify(r.json)}`);

  /* ═══ 8. APPROVE THE BOOK ═══ */
  log('approve', 'Approving the book as admin...');
  r = await call('PUT', `/api/senior/review-queue/${bookId}`, {
    action: 'approved',
  }, adminToken);

  if (r.status === 200) {
    log('ok', 'Book approved! It should now be LIVE.');
  } else {
    log('approve', `Approval returned ${r.status}: ${JSON.stringify(r.json)}`);
    // Try the book-edits approve endpoint
    r = await call('GET', `/api/senior/review-queue?status=pending`, null, adminToken);
    log('queue', `status=${r.status}`);
    if (r.json && r.json.items) {
      const pending = r.json.items.find(b => (b.id || b._id) === bookId);
      if (pending) {
        const editId = pending.proposalId || pending.editId || pending.id;
        r = await call('POST', `/api/senior/book-edits/${editId}/approve`, {}, adminToken);
        log('approve-edit', `status=${r.status}`);
      }
    }
  }

  /* ═══ SUMMARY ═══ */
  console.log('\n═══════════════════════════════════════════');
  console.log('  LIVE BOOK PIPELINE COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Admin email:    ${ADMIN_EMAIL}`);
  console.log(`  Admin password: ${NEW_PW}`);
  console.log(`  Book ID:        ${bookId}`);
  console.log(`  Book title:     ${book.title}`);
  console.log(`  Chapters:       ${CHAPTERS.length}`);
  console.log(`  Total words:    ${totalWords}`);
  console.log(`  Status:         ${r.status === 200 ? 'APPROVED (LIVE)' : 'PENDING'}`);
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });