/**
 * launch-kit-data.js — Campaign data for DroBoard
 * Campaign model: CREATE → SHARE → TRACK → GROW
 */
(function () {
  'use strict';

  var COVERS = [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1510172951991-856a654063f9?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1589998059171-988d887df646?w=300&h=400&fit=crop',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=300&h=400&fit=crop'
  ];
  var WIDE = [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1510172951991-856a654063f9?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1589998059171-988d887df646?w=600&h=300&fit=crop',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=300&fit=crop'
  ];
  var AVATARS = [
    'https://i.pravatar.cc/150?img=68',
    'https://i.pravatar.cc/150?img=12',
    'https://i.pravatar.cc/150?img=23',
    'https://i.pravatar.cc/150?img=25',
    'https://i.pravatar.cc/150?img=33',
    'https://i.pravatar.cc/150?img=44',
    'https://i.pravatar.cc/150?img=51',
    'https://i.pravatar.cc/150?img=32',
    'https://i.pravatar.cc/150?img=47',
    'https://i.pravatar.cc/150?img=53'
  ];

  window.LaunchKitData = [
    {
      id: 'lk_001', writerId: 'w_001', writerName: 'Tobi Adenuga', writerAvatar: AVATARS[0],
      campaignName: 'The Last Sunrise', campaignType: 'book', campaignImage: COVERS[0], campaignImageWide: WIDE[0],
      description: 'A romance set in Lagos that will keep you turning pages.',
      destination: 'https://droboard.app/read/the-last-sunrise',
      cta: 'Read Now',
      referralCode: 'TOBI2026',
      campaignLink: 'https://droboard.app/c/last-sunrise?ref=TOBI2026',
      status: 'active', launchDate: '2026-08-15', created: '2026-07-20',
      analytics: { visitors: 2481, clicks: 643, conversions: 118, conversionRate: 18.35 },
      sources: { whatsapp: 1024, facebook: 642, tiktok: 381, instagram: 267, direct: 167 },
      promoters: [
        { name: 'Sarah', link: 'https://droboard.app/c/last-sunrise?ref=sarah', clicks: 312, conversions: 47 },
        { name: 'David', link: 'https://droboard.app/c/last-sunrise?ref=david', clicks: 171, conversions: 29 },
        { name: 'John', link: 'https://droboard.app/c/last-sunrise?ref=john', clicks: 104, conversions: 18 }
      ],
      assets: {
        whatsapp: 'My new story "The Last Sunrise" is now live on DroBoard! Come read the first chapter for free. Link in bio.',
        facebook: 'Excited to announce that my story "The Last Sunrise" is now available on DroBoard! It\'s a romance set in Lagos that will keep you turning pages.',
        tiktok: 'POV: You just finished writing your first novel and it\'s finally live! Go read "The Last Sunrise" on DroBoard. Link in bio! #DroBoard #NigerianWriter #BookTok',
        instagram: 'The Last Sunrise is finally here. A story of love, fate, and the Lagos lagoon. Link in bio.',
        excerpt: 'The sun was setting over the Lagos lagoon, painting the sky in shades of orange and purple. Amara stood at the edge of the pier, watching the fishing boats return home.',
        caption: 'New book just dropped. #TheLastSunrise #DroBoard'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: true },
        { threshold: 100, label: 'Cash bonus', earned: false },
        { threshold: 500, label: 'Partnership deal', earned: false }
      ],
      countdown: [
        { day: 7, text: '7 days until my story goes live on DroBoard!' },
        { day: 5, text: '5 days to go! The Last Sunrise is almost here.' },
        { day: 3, text: '3 more days of waiting... then it\'s reading time!' },
        { day: 1, text: 'TOMORROW! The Last Sunrise drops on DroBoard.' }
      ]
    },
    {
      id: 'lk_002', writerId: 'w_002', writerName: 'Chidi Okafor', writerAvatar: AVATARS[1],
      campaignName: 'Whispers of the East', campaignType: 'book', campaignImage: COVERS[1], campaignImageWide: WIDE[1],
      description: 'A thriller that follows a detective in Enugu who uncovers a conspiracy.',
      destination: 'https://droboard.app/read/whispers-of-the-east',
      cta: 'Read Now',
      referralCode: 'CHIDI2026',
      campaignLink: 'https://droboard.app/c/whispers-east?ref=CHIDI2026',
      status: 'active', launchDate: '2026-08-20', created: '2026-07-22',
      analytics: { visitors: 1890, clicks: 520, conversions: 89, conversionRate: 17.12 },
      sources: { whatsapp: 812, facebook: 498, tiktok: 312, instagram: 178, direct: 90 },
      promoters: [
        { name: 'Nneka', link: 'https://droboard.app/c/whispers-east?ref=nneka', clicks: 245, conversions: 38 },
        { name: 'Emeka', link: 'https://droboard.app/c/whispers-east?ref=emeka', clicks: 167, conversions: 24 }
      ],
      assets: {
        whatsapp: 'My thriller "Whispers of the East" just launched on DroBoard! Read chapter 1 free now.',
        facebook: 'My new thriller "Whispers of the East" is live on DroBoard! It follows a detective in Enugu who uncovers a conspiracy.',
        tiktok: 'If you love African thrillers with plot twists, you NEED to read "Whispers of the East" on DroBoard. #AfricanThriller #DroBoard #BookTok',
        instagram: 'Detective Nnamdi has a case that will change everything. Whispers of the East is live.',
        excerpt: 'Detective Nnamdi stared at the photograph pinned to his board. Three dead men, all connected to the same company.',
        caption: 'New thriller just dropped. Can you solve it?'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: false },
        { threshold: 100, label: 'Cash bonus', earned: false }
      ],
      countdown: []
    },
    {
      id: 'lk_003', writerId: 'w_003', writerName: 'Adaeze Nwosu', writerAvatar: AVATARS[2],
      campaignName: 'Shadows of Ibadan', campaignType: 'book', campaignImage: COVERS[2], campaignImageWide: WIDE[2],
      description: 'A historical fiction about love and resistance in 1960s Nigeria.',
      destination: 'https://droboard.app/read/shadows-of-ibadan',
      cta: 'Read Now',
      referralCode: 'ADAEZE2026',
      campaignLink: 'https://droboard.app/c/shadows-ibadan?ref=ADAEZE2026',
      status: 'active', launchDate: '2026-07-15', created: '2026-06-28',
      analytics: { visitors: 5670, clicks: 1890, conversions: 412, conversionRate: 21.80 },
      sources: { whatsapp: 2104, facebook: 1442, tiktok: 981, instagram: 667, direct: 476 },
      promoters: [
        { name: 'Funke', link: 'https://droboard.app/c/shadows-ibadan?ref=funke', clicks: 567, conversions: 112 },
        { name: 'Bola', link: 'https://droboard.app/c/shadows-ibadan?ref=bola', clicks: 423, conversions: 85 },
        { name: 'Yemi', link: 'https://droboard.app/c/shadows-ibadan?ref=yemi', clicks: 312, conversions: 67 }
      ],
      assets: {
        whatsapp: 'My historical fiction "Shadows of Ibadan" is live on DroBoard! A story about love and resistance in 1960s Nigeria.',
        facebook: 'My historical fiction "Shadows of Ibadan" is now available on DroBoard! It follows three women in 1960s Nigeria.',
        tiktok: 'Did you know about the women who fought for independence in Ibadan? My story tells their tale. #NigerianHistory #DroBoard #BookTok',
        instagram: 'Three women. One fight. Shadows of Ibadan is live.',
        excerpt: 'The morning market at Oja Oba was already bustling when Nneka arrived. She clutched the folded newspaper to her chest like a secret weapon.',
        caption: 'History, love, and resistance. Shadows of Ibadan is here.'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: true },
        { threshold: 100, label: 'Cash bonus', earned: true },
        { threshold: 500, label: 'Partnership deal', earned: false }
      ],
      countdown: []
    },
    {
      id: 'lk_004', writerId: 'w_004', writerName: 'Kemi Adeyemi', writerAvatar: AVATARS[3],
      campaignName: 'Lagos Nights', campaignType: 'book', campaignImage: COVERS[3], campaignImageWide: WIDE[3],
      description: 'A contemporary story about love and ambition in Lagos.',
      destination: 'https://droboard.app/read/lagos-nights',
      cta: 'Read Now',
      referralCode: 'KEMI2026',
      campaignLink: 'https://droboard.app/c/lagos-nights?ref=KEMI2026',
      status: 'scheduled', launchDate: '2026-08-25', created: '2026-07-25',
      analytics: { visitors: 0, clicks: 0, conversions: 0, conversionRate: 0 },
      sources: { whatsapp: 0, facebook: 0, tiktok: 0, instagram: 0, direct: 0 },
      promoters: [],
      assets: {
        whatsapp: 'Coming soon! My new story "Lagos Nights" launches on DroBoard August 25th.',
        facebook: 'Mark your calendars! "Lagos Nights" launches on DroBoard August 25th.',
        tiktok: 'Lagos at night is a different world. My new story captures all the magic, danger, and romance. August 25th! #LagosNights #DroBoard',
        instagram: 'Lagos Nights. Coming August 25th.',
        excerpt: 'The Uber weaved through the traffic on Third Mainland Bridge, and Funke pressed her forehead against the cool glass.',
        caption: 'Lagos Nights. Coming soon.'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: false },
        { threshold: 50, label: 'Premium badge', earned: false }
      ],
      countdown: [
        { day: 7, text: '7 days until Lagos Nights drops!' },
        { day: 5, text: '5 days! Lagos Nights is almost here.' },
        { day: 3, text: '3 more days of waiting...' },
        { day: 1, text: 'TOMORROW! Lagos Nights goes live.' }
      ]
    },
    {
      id: 'lk_005', writerId: 'w_005', writerName: 'Obinna Eze', writerAvatar: AVATARS[4],
      campaignName: 'The Python King', campaignType: 'book', campaignImage: COVERS[4], campaignImageWide: WIDE[4],
      description: 'An African fantasy epic about ancient gods and power.',
      destination: 'https://droboard.app/read/the-python-king',
      cta: 'Read Now',
      referralCode: 'OBINNA2026',
      campaignLink: 'https://droboard.app/c/python-king?ref=OBINNA2026',
      status: 'active', launchDate: '2026-07-01', created: '2026-06-15',
      analytics: { visitors: 8920, clicks: 3200, conversions: 745, conversionRate: 23.28 },
      sources: { whatsapp: 3204, facebook: 2102, tiktok: 1891, instagram: 1102, direct: 621 },
      promoters: [
        { name: 'Chidi', link: 'https://droboard.app/c/python-king?ref=chidi', clicks: 892, conversions: 178 },
        { name: 'Adaeze', link: 'https://droboard.app/c/python-king?ref=adaeze', clicks: 643, conversions: 145 },
        { name: 'Tunde', link: 'https://droboard.app/c/python-king?ref=tunde', clicks: 521, conversions: 98 }
      ],
      assets: {
        whatsapp: 'My fantasy epic "The Python King" is live on DroBoard! 500+ readers already. Join them!',
        facebook: 'The Python King has arrived! My African fantasy epic is now live on DroBoard with over 500 readers.',
        tiktok: 'What if the ancient gods of Nigeria were real? Read "The Python King" on DroBoard! #AfricanFantasy #DroBoard #BookTok',
        instagram: 'The Python King has arrived. African fantasy at its finest.',
        excerpt: 'Emeka was herding goats on the hillside when the earth began to shake. The ancient baobab tree at the center of the village split open.',
        caption: 'The Python King is here. Are you ready?'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: true },
        { threshold: 100, label: 'Cash bonus', earned: true },
        { threshold: 500, label: 'Partnership deal', earned: true }
      ],
      countdown: []
    },
    {
      id: 'lk_006', writerId: 'w_006', writerName: 'Nneka Okoro', writerAvatar: AVATARS[5],
      campaignName: 'Hearts in Accra', campaignType: 'book', campaignImage: COVERS[5], campaignImageWide: WIDE[5],
      description: 'A romance set in Accra about love across borders.',
      destination: 'https://droboard.app/read/hearts-in-accra',
      cta: 'Read Now',
      referralCode: 'NNEKA2026',
      campaignLink: 'https://droboard.app/c/hearts-accra?ref=NNEKA2026',
      status: 'draft', launchDate: '2026-09-01', created: null,
      analytics: { visitors: 0, clicks: 0, conversions: 0, conversionRate: 0 },
      sources: { whatsapp: 0, facebook: 0, tiktok: 0, instagram: 0, direct: 0 },
      promoters: [],
      assets: {
        whatsapp: '', facebook: '', tiktok: '', instagram: '',
        excerpt: 'The taxi dropped her off at the airport in Accra, and the warm Ghanaian air hit her face like a welcome.',
        caption: ''
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: false }
      ],
      countdown: []
    },
    {
      id: 'lk_007', writerId: 'w_007', writerName: 'Emeka Chukwu', writerAvatar: AVATARS[6],
      campaignName: 'Born by the River', campaignType: 'book', campaignImage: COVERS[6], campaignImageWide: WIDE[6],
      description: 'A drama about a man who must return to his hometown.',
      destination: 'https://droboard.app/read/born-by-the-river',
      cta: 'Read Now',
      referralCode: 'EMEKA2026',
      campaignLink: 'https://droboard.app/c/born-river?ref=EMEKA2026',
      status: 'active', launchDate: '2026-08-30', created: '2026-07-28',
      analytics: { visitors: 560, clicks: 180, conversions: 32, conversionRate: 17.78 },
      sources: { whatsapp: 210, facebook: 142, tiktok: 98, instagram: 67, direct: 43 },
      promoters: [
        { name: 'Ifeoma', link: 'https://droboard.app/c/born-river?ref=ifeoma', clicks: 89, conversions: 15 }
      ],
      assets: {
        whatsapp: 'My drama "Born by the River" launches August 30th on DroBoard!',
        facebook: 'Born by the River launches August 30th! A drama about a man who must return to his hometown.',
        tiktok: 'What happens when you return to the village you ran away from 20 years later? #ComingHome #DroBoard #BookTok',
        instagram: 'Born by the River. Coming August 30th.',
        excerpt: 'Chike hadn\'t been back to Nnewi in twenty years. The bus ride from Lagos took fourteen hours.',
        caption: 'Born by the River. Coming soon.'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: false }
      ],
      countdown: [
        { day: 7, text: '7 days until Born by the River launches!' },
        { day: 5, text: '5 days! Born by the River is coming.' },
        { day: 3, text: '3 more days to go...' },
        { day: 1, text: 'TOMORROW! Born by the River drops.' }
      ]
    },
    {
      id: 'lk_008', writerId: 'w_008', writerName: 'Folake Balogun', writerAvatar: AVATARS[7],
      campaignName: 'Daughters of Lagos', campaignType: 'book', campaignImage: COVERS[7], campaignImageWide: WIDE[7],
      description: 'Three sisters, one family secret, and a truth that changes everything.',
      destination: 'https://droboard.app/read/daughters-of-lagos',
      cta: 'Read Now',
      referralCode: 'FOLAKE2026',
      campaignLink: 'https://droboard.app/c/daughters-lagos?ref=FOLAKE2026',
      status: 'active', launchDate: '2026-07-10', created: '2026-06-20',
      analytics: { visitors: 4230, clicks: 1560, conversions: 342, conversionRate: 21.92 },
      sources: { whatsapp: 1604, facebook: 1102, tiktok: 781, instagram: 467, direct: 276 },
      promoters: [
        { name: 'Titi', link: 'https://droboard.app/c/daughters-lagos?ref=titi', clicks: 423, conversions: 85 },
        { name: 'Kemi', link: 'https://droboard.app/c/daughters-lagos?ref=kemi', clicks: 312, conversions: 67 }
      ],
      assets: {
        whatsapp: 'Three sisters. One family secret. "Daughters of Lagos" is live on DroBoard!',
        facebook: 'Daughters of Lagos is live! Three sisters, one family secret, and a truth that changes everything.',
        tiktok: 'When three sisters discover their mother\'s hidden diary, their entire family history unravels. #Sisters #DroBoard #BookTok',
        instagram: 'Three sisters. One secret. Daughters of Lagos is live.',
        excerpt: 'The funeral was barely over when Funke found the diary. It was hidden inside their mother\'s jewelry box.',
        caption: 'Daughters of Lagos. The truth changes everything.'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: true },
        { threshold: 100, label: 'Cash bonus', earned: true },
        { threshold: 500, label: 'Partnership deal', earned: false }
      ],
      countdown: []
    },
    {
      id: 'lk_009', writerId: 'w_009', writerName: 'Bola Ahmed', writerAvatar: AVATARS[8],
      campaignName: 'The Server Room', campaignType: 'book', campaignImage: COVERS[8], campaignImageWide: WIDE[8],
      description: 'A tech thriller about a Lagos startup that accidentally creates something dangerous.',
      destination: 'https://droboard.app/read/the-server-room',
      cta: 'Read Now',
      referralCode: 'BOLA2026',
      campaignLink: 'https://droboard.app/c/server-room?ref=BOLA2026',
      status: 'active', launchDate: '2026-08-10', created: '2026-07-18',
      analytics: { visitors: 1450, clicks: 480, conversions: 78, conversionRate: 16.25 },
      sources: { whatsapp: 542, facebook: 381, tiktok: 267, instagram: 156, direct: 104 },
      promoters: [
        { name: 'Damilola', link: 'https://droboard.app/c/server-room?ref=damilola', clicks: 189, conversions: 29 }
      ],
      assets: {
        whatsapp: 'My tech thriller "The Server Room" launches August 10th! When code becomes a weapon.',
        facebook: 'The Server Room launches August 10th! A tech thriller set in Lagos.',
        tiktok: 'What if a Lagos startup unknowingly built an AI that could topple governments? #TechThriller #DroBoard',
        instagram: 'The Server Room. When code becomes a weapon.',
        excerpt: 'The notification came at 3:47 AM. Yemi\'s phone buzzed on the nightstand, pulling her out of a deep sleep.',
        caption: 'The Server Room. Coming August 10th.'
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: true },
        { threshold: 50, label: 'Premium badge', earned: false }
      ],
      countdown: [
        { day: 7, text: '7 days until The Server Room launches!' },
        { day: 5, text: '5 days! The Server Room is almost here.' },
        { day: 3, text: '3 days left! Tech lovers, this one is for you.' },
        { day: 1, text: 'TOMORROW! The Server Room goes live.' }
      ]
    },
    {
      id: 'lk_010', writerId: 'w_010', writerName: 'Tunde Kelani', writerAvatar: AVATARS[9],
      campaignName: 'Moonlight over Osogbo', campaignType: 'book', campaignImage: COVERS[9], campaignImageWide: WIDE[9],
      description: 'A literary fiction about mystery and the sacred groves of Osogbo.',
      destination: 'https://droboard.app/read/moonlight-osogbo',
      cta: 'Read Now',
      referralCode: 'TUNDE2026',
      campaignLink: 'https://droboard.app/c/moonlight-osogbo?ref=TUNDE2026',
      status: 'draft', launchDate: '2026-09-15', created: null,
      analytics: { visitors: 0, clicks: 0, conversions: 0, conversionRate: 0 },
      sources: { whatsapp: 0, facebook: 0, tiktok: 0, instagram: 0, direct: 0 },
      promoters: [],
      assets: {
        whatsapp: '', facebook: '', tiktok: '', instagram: '',
        excerpt: 'The Osun river was glowing under the full moon. Adebayo stood on the sacred grove\'s edge, watching the silver light dance on the water.',
        caption: ''
      },
      rewards: [
        { threshold: 10, label: 'Homepage feature', earned: false }
      ],
      countdown: []
    }
  ];
})();
