/* ═══════════════════════════════════════════════════════════════
   mockData.js — ALL demo/placeholder content for discover.html in
   one place. Nothing in here talks to the DOM or knows how it will
   be rendered; it just returns plain data, the same shape the real
   API is expected to return.

   Swapping demo → live only ever touches discover.html's USE_API /
   API_BASE + the fetch* functions there. This file stays untouched
   (or gets deleted) once a backend exists — nothing else references
   it directly.
═══════════════════════════════════════════════════════════════ */
(function (global) {

  const COVERS = [
    'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
    'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    'https://i.postimg.cc/ftRZbhKx/3.jpg',
    'https://i.postimg.cc/N9jY0w4m/5.jpg',
    'https://i.postimg.cc/JDzmhWqj/2.jpg',
    'https://i.postimg.cc/DJwFzKgd/4.jpg',
    'https://i.postimg.cc/cgLZJNmC/8.jpg',
    'https://i.postimg.cc/0MyxNqfz/7.jpg',
    'https://i.postimg.cc/WF1j4Pnh/6.jpg',
    'https://i.postimg.cc/fkdXzjSj/wife.jpg',
  ];
  const c = i => COVERS[i % COVERS.length];

  /* ── Ads — same shape fetchAds() in discover.html expects back
     from a real API: { platformAds: [...], bookAds: [...] } ── */
  const PLATFORM_ADS = [
    { title: 'DroBoard Premium — Read Ad-Free', sponsor: 'DroBoard', cta: 'Upgrade Now' },
    { title: 'Get 3 Months of Unlimited Coins', sponsor: 'DroBoard Coins', cta: 'Claim Offer' },
    { title: 'Write Your Own Story Today', sponsor: 'DroBoard Studio', cta: 'Start Writing' },
  ];
  const BOOK_ADS = [
    { title: 'Crowned in Sin', author: '@Nkemdilim_R', genre: 'Mafia', rating: '4.9', chapters: 32, preview: 'An indie mafia romance climbing the charts — read the debut everyone is talking about.' },
    { title: 'Werewolf King, Human Queen', author: '@Tobenna_K', genre: 'Werewolf', rating: '4.6', chapters: 19, preview: 'A new voice in werewolf romance. Chapter one is free for the next 48 hours.' },
    { title: 'The Billionaire Never Forgets', author: '@Sarah_Odum', genre: 'Billionaire', rating: '4.7', chapters: 24, preview: 'Self-published and rising fast — a slow-burn billionaire romance readers can\u2019t put down.' },
    { title: 'Campus Chaos', author: '@Bode_Ilo', genre: 'Campus', rating: '4.5', chapters: 16, preview: 'A campus rom-com getting buzz this month. New chapters every Friday.' },
    { title: 'Fangs & Fortune', author: '@Ese_Uyi', genre: 'Fantasy', rating: '4.8', chapters: 29, preview: 'Dark fantasy romance from an indie author breaking into the charts.' },
  ];

  /** Same shape a real GET {API_BASE}/discover/ads should return. */
  function getDemoAds() {
    return {
      platformAds: PLATFORM_ADS.map((ad, i) => ({ ...ad, img: c(i + 2) })),
      bookAds: BOOK_ADS.map((ad, i) => ({ ...ad, img: c(i + 7) })),
    };
  }

  /* ── Demo payload (same shape GET {API_BASE}/discover should return) ── */
  function getDemoData() {
    return {
      heroes: [
        { img: c(0), title: 'HIS <em>Sweet</em><br>REVENGE', author: 'By Luna Grey', tags: ['Mafia', 'Romance'] },
        { img: c(1), title: 'UNTIL YOU<br>REGRET', author: 'By Ada Writes', tags: ['Revenge', 'Romance'] },
        { img: c(2), title: 'CLAIMING HIS<br>LUNA', author: 'By Ifeanyi Story', tags: ['Werewolf', 'Romance'] },
        { img: c(3), title: 'BOUND<br>BY HER', author: 'By Efe O', tags: ['Romance', 'Drama'] },
      ],
      continueReading: [
        { img: c(2), title: "The Alpha's Obsession", author: '@Ifeanyi_Story', ch: 'Chapter 18', pct: 43 },
        { img: c(0), title: 'Falling for My Fake Husband', author: '@Ada_Writes', ch: 'Chapter 12', pct: 25 },
        { img: c(1), title: "The Mafia's Secret Wife", author: '@Chiamaka_N', ch: 'Chapter 24', pct: 60 },
        { img: c(3), title: 'His Ruthless Obsession', author: '@Zara_M', ch: 'Chapter 31', pct: 78 },
        { img: c(4), title: 'Bound by Her Silence', author: '@Kemi_A', ch: 'Chapter 9', pct: 15 },
        { img: c(5), title: 'Claimed at Midnight', author: '@Efe_O', ch: 'Chapter 42', pct: 55 },
        { img: c(6), title: 'The Contract Bride', author: '@CampusQueen', ch: 'Chapter 16', pct: 33 },
        { img: c(7), title: 'Luna of the North', author: '@Dami_Cole', ch: 'Chapter 28', pct: 70 },
      ],
      topRomance: [
        { img: c(0), title: "The CEO's Hidden Heir", author: '@Ada_Writes', badge: 'new', rating: '4.8' },
        { img: c(1), title: 'Devil in a Suit', author: '@Zara_M', badge: 'hot', rating: '4.7' },
        { img: c(2), title: 'Protected by the Billionaire', author: '@Chiamaka_N', badge: 'new', rating: '4.9' },
        { img: c(3), title: 'Broken Vows', author: '@Kemi_A', badge: 'new', rating: '4.6' },
        { img: c(4), title: 'His Second Chance', author: '@Efe_O', rating: '4.5' },
        { img: c(5), title: 'Married for Revenge', author: '@Ifeanyi_Story', badge: 'hot', rating: '4.8' },
        { img: c(6), title: 'The Billionaire Next Door', author: '@CampusQueen', rating: '4.4' },
        { img: c(7), title: 'Love in Disguise', author: '@Dami_Cole', badge: 'new', rating: '4.7' },
        { img: c(8), title: 'Her Secret Admirer', author: '@Ada_Writes', rating: '4.3' },
        { img: c(9), title: 'Twisted Hearts', author: '@Zara_M', badge: 'hot', rating: '4.9' },
      ],
      trending: [
        { img: c(0), title: 'The Ruthless Billionaire', author: '@Ada_Writes', rank: 1 },
        { img: c(2), title: 'Second Chance for the Luna', author: '@Ifeanyi_Story', rank: 2 },
        { img: c(1), title: "Mafia's Little Angel", author: '@Chiamaka_N', rank: 3 },
        { img: c(3), title: 'Entangled Hearts', author: '@Kemi_A', rank: 4 },
        { img: c(4), title: 'The Forbidden Alpha', author: '@Zara_M', rank: 5 },
        { img: c(5), title: 'She Was His Weakness', author: '@Efe_O', rank: 6 },
        { img: c(6), title: 'Vengeance & Vows', author: '@CampusQueen', rank: 7 },
        { img: c(7), title: 'The Silent Bride', author: '@Dami_Cole', rank: 8 },
        { img: c(8), title: 'Blood and Roses', author: '@Ada_Writes', rank: 9 },
        { img: c(9), title: 'His Dark Promise', author: '@Ifeanyi_Story', rank: 10 },
      ],
      collections: [
        { name: 'Stories That Wrecked Me', count: 14, covers: [c(1), c(0), c(4), c(2)] },
        { name: 'Best Plot Twists 2026', count: 8, covers: [c(5), c(3), c(6), c(7)] },
        { name: '2am Crying Material', count: 11, covers: [c(4), c(0), c(8), c(1)] },
        { name: 'Campus & CEO Classics', count: 6, covers: [c(6), c(9), c(3), c(5)] },
        { name: 'Revenge Arc Masterclass', count: 9, covers: [c(1), c(2), c(0), c(4)] },
      ],
      newReleases: [
        { img: c(4), title: 'Untouchable Desire', author: '@Zara_M', badge: 'new' },
        { img: c(5), title: "Fate's Revenge", author: '@Ada_Writes', badge: 'new' },
        { img: c(6), title: 'Not Your Princess', author: '@CampusQueen', badge: 'new' },
        { img: c(7), title: 'Married to the Enemy', author: '@Chiamaka_N', badge: 'new' },
        { img: c(8), title: 'The Last Confession', author: '@Efe_O', badge: 'new' },
        { img: c(9), title: 'Whispers of Betrayal', author: '@Kemi_A', badge: 'new' },
        { img: c(0), title: 'Crown of Thorns', author: '@Ifeanyi_Story', badge: 'new' },
        { img: c(1), title: 'Her Hidden Truth', author: '@Dami_Cole', badge: 'new' },
        { img: c(2), title: 'The Stranger at Midnight', author: '@Zara_M', badge: 'new' },
        { img: c(3), title: 'Love After Ruin', author: '@Ada_Writes', badge: 'new' },
      ],
      editorsPicks: [
        { img: c(1), title: 'Until You Regret', author: '@Ada_Writes' },
        { img: c(0), title: 'I Will Never Be Yours', author: '@Chiamaka_N' },
        { img: c(2), title: "Carrying The Mafia Lord's Baby", author: '@Zara_M' },
        { img: c(3), title: 'Reclaimed by My Alpha', author: '@Ifeanyi_Story' },
        { img: c(4), title: 'The Night She Returned', author: '@Kemi_A' },
        { img: c(5), title: 'His Untamed Luna', author: '@Efe_O' },
        { img: c(6), title: 'Broken by Him', author: '@CampusQueen' },
        { img: c(7), title: 'The Price of Love', author: '@Dami_Cole' },
        { img: c(8), title: 'Shadows of Desire', author: '@Ada_Writes' },
        { img: c(9), title: 'When Hearts Collide', author: '@Zara_M' },
      ],
      recommended: [
        { img: c(4), title: "His Choice Wasn't Me", author: '@Kemi_A' },
        { img: c(0), title: 'Bound by Obsession', author: '@Ada_Writes' },
        { img: c(1), title: 'The Wife He Threw Away', author: '@Chiamaka_N' },
        { img: c(2), title: "My Sister's Best Friend", author: '@Zara_M' },
        { img: c(5), title: 'The Man She Left Behind', author: '@Efe_O' },
        { img: c(6), title: 'Stolen Moments', author: '@CampusQueen' },
        { img: c(7), title: 'Her Ruthless King', author: '@Ifeanyi_Story' },
        { img: c(8), title: 'A Love Like Fire', author: '@Dami_Cole' },
        { img: c(9), title: 'Never Look Back', author: '@Ada_Writes' },
        { img: c(3), title: 'The Softest Rejection', author: '@Kemi_A' },
      ],
      complete: [
        { img: c(2), title: 'Alpha Stefano', author: '@Ifeanyi_Story' },
        { img: c(0), title: 'The Secret Heir', author: '@Ada_Writes' },
        { img: c(1), title: 'Bound by Darkness', author: '@Zara_M' },
        { img: c(3), title: "The Billionaire's Contract", author: '@Chiamaka_N' },
        { img: c(4), title: 'Complete Surrender', author: '@Kemi_A' },
        { img: c(5), title: 'The Final Vow', author: '@Efe_O' },
        { img: c(6), title: 'Ends With Us', author: '@CampusQueen' },
        { img: c(7), title: 'Forever His', author: '@Dami_Cole' },
        { img: c(8), title: 'The Last Chapter', author: '@Ada_Writes' },
        { img: c(9), title: 'Home at Last', author: '@Ifeanyi_Story' },
      ],
      recentlyUpdated: [
        { img: c(1), title: 'Ruthless Desires', author: '@Ada_Writes', badge: 'update', meta: 'Ch. 86' },
        { img: c(2), title: 'Claimed by The Alpha', author: '@Ifeanyi_Story', badge: 'update', meta: 'Ch. 72' },
        { img: c(0), title: "The CEO's Obsession", author: '@Zara_M', badge: 'update', meta: 'Ch. 54' },
        { img: c(3), title: 'Hidden Truths Unveiled', author: '@Chiamaka_N', badge: 'update', meta: 'Ch. 97' },
        { img: c(4), title: 'Her Silent War', author: '@Kemi_A', badge: 'update', meta: 'Ch. 41' },
        { img: c(5), title: 'Bloodline Secrets', author: '@Efe_O', badge: 'update', meta: 'Ch. 63' },
        { img: c(6), title: 'The Pack Divided', author: '@CampusQueen', badge: 'update', meta: 'Ch. 29' },
        { img: c(7), title: 'Empire of Lies', author: '@Dami_Cole', badge: 'update', meta: 'Ch. 105' },
        { img: c(8), title: 'After the Fall', author: '@Ada_Writes', badge: 'update', meta: 'Ch. 18' },
        { img: c(9), title: 'Rise of the Luna', author: '@Ifeanyi_Story', badge: 'update', meta: 'Ch. 77' },
      ],
      /* List stories: title, preview, genre, author, cover */
      moreStories: [
        { title: 'The Letter Never Sent', author: '@Efe_O', genre: 'Drama', preview: 'She found the letter in his drawer three years after he left. What it said changed everything she thought she knew about their last night together.', img: c(8) },
        { title: 'Socks at the Altar', author: '@Ifeanyi_Story', genre: 'Romance', preview: 'The bride ran in socks. The groom followed. Neither expected the storm — or the truth — waiting outside the church doors.', img: c(5) },
        { title: "Grandmother's Hidden Will", author: '@Chiamaka_N', genre: 'Family', preview: 'The will named someone no one in the family had ever heard of. Finding her would unlock a secret older than the house itself.', img: c(5) },
        { title: 'Stepmother Stole My Future', author: '@Zara_M', genre: 'Revenge', preview: 'She took the scholarship, the inheritance, and the man. Now the real daughter is back — and the game has changed.', img: c(3) },
        { title: 'Kissing Her Photograph', author: '@Ada_Writes', genre: 'Betrayal', preview: 'He kissed the photo every night. She thought it was devotion. She was wrong — and the truth would destroy them both.', img: c(4) },
        { title: 'Richest Boy in Class', author: '@CampusQueen', genre: 'Campus', preview: 'He owned half the campus before he turned twenty. She was the scholarship girl who refused to look at him. Until the project paired them.', img: c(6) },
        { title: 'Deleted on Our Anniversary', author: '@Kemi_A', genre: 'Heartbreak', preview: 'Every photo, every message, gone. On the day they were supposed to celebrate five years. She needed answers. He needed silence.', img: c(7) },
        { title: 'Three Times She Said No', author: '@Dami_Cole', genre: 'Romance', preview: 'He asked three times. She said no three times. The fourth time, it was her turn to ask — and the answer surprised them both.', img: c(9) },
        { title: 'The House on Willow Lane', author: '@Efe_O', genre: 'Horror', preview: 'The house had been empty for twelve years. The new tenants lasted three nights. What they left behind was worse than what they found.', img: c(8) },
        { title: 'Scholarship Girl Rising', author: '@CampusQueen', genre: 'Campus', preview: 'One scholarship. One secret. One boy who knew both. She came for an education — and found a war she never signed up for.', img: c(6) },
        { title: 'Boss Before Revealing', author: '@Zara_M', genre: 'Revenge', preview: 'She worked under him for two years. He never knew she was the one he ruined. Until the merger put her name on the board.', img: c(0) },
        { title: 'Left Everything Behind', author: '@Ada_Writes', genre: 'Drama', preview: 'Passport. One bag. No goodbye. She vanished on a Tuesday. Six months later, the letter arrived — and nothing would be the same.', img: c(1) },
        { title: 'The Softest Goodbye', author: '@Kemi_A', genre: 'Romance', preview: 'They agreed it was over. No fighting. No blame. Just the softest goodbye either of them had ever given — and the hardest to keep.', img: c(3) },
        { title: 'Blood in the Boardroom', author: '@Chiamaka_N', genre: 'Mafia', preview: 'The deal was clean on paper. In the room, nothing was. She walked in as the lawyer. She walked out as the only one who knew the truth.', img: c(2) },
        { title: 'Moonlight Betrayal', author: '@Ifeanyi_Story', genre: 'Werewolf', preview: 'The pack called her luna. The alpha called her his. Under the full moon, she learned she was neither — and everything shifted.', img: c(2) },
        { title: 'Contract Without Love', author: '@Dami_Cole', genre: 'Billionaire', preview: 'A one-year marriage. No feelings. No questions. The contract was perfect — until year one ended and neither wanted to leave.', img: c(0) },
        { title: 'Her Name Was Vengeance', author: '@Zara_M', genre: 'Revenge', preview: 'They took her family. They took her name. They left her alive. That was their first mistake — and their last.', img: c(1) },
        { title: 'The Quiet Twin', author: '@Efe_O', genre: 'Mystery', preview: 'One twin died. One twin lived. The living one started wearing the dead one’s clothes — and answering to her name.', img: c(5) },
        { title: 'Fire in the Rain', author: '@Ada_Writes', genre: 'Romance', preview: 'They met in a storm. She needed a ride. He needed a reason to stay. Neither expected the fire that started when the rain stopped.', img: c(4) },
        { title: 'Alpha Without a Pack', author: '@Ifeanyi_Story', genre: 'Werewolf', preview: 'He lost everything in one night. No pack. No mate. No name worth speaking. Then she found him — and the war found them both.', img: c(2) },
        { title: 'The Heiress Who Ran', author: '@Chiamaka_N', genre: 'Drama', preview: 'Billions waiting. A wedding planned. She ran at dawn with nothing but a train ticket and a secret the family would kill to bury.', img: c(7) },
        { title: 'Paper Rings & Lies', author: '@Kemi_A', genre: 'Romance', preview: 'Paper rings in a parking lot. A promise they never meant to keep. Ten years later, the lie still held — until the truth walked in.', img: c(9) },
        { title: 'Night of the Rogues', author: '@CampusQueen', genre: 'Werewolf', preview: 'The border fell at midnight. Rogues poured in. She was the only one who could stop them — if the pack still trusted her.', img: c(8) },
        { title: 'His Cold Empire', author: '@Dami_Cole', genre: 'Mafia', preview: 'He built an empire on silence and fear. She was the only person who made him speak. That made her the most dangerous person in the city.', img: c(0) },
        { title: 'When She Stopped Waiting', author: '@Ada_Writes', genre: 'Heartbreak', preview: 'Five years of waiting. One letter that never came. The day she stopped waiting was the day he finally showed up — too late.', img: c(3) },
      ],
    };
  }

  global.MockData = { COVERS, c, PLATFORM_ADS, BOOK_ADS, getDemoAds, getDemoData };

})(window);