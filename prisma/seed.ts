import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting MusicWave Database Seeding...');

  // 1. Clean existing records in cascade order
  await prisma.notification.deleteMany();
  await prisma.follower.deleteMany();
  await prisma.recentlyPlayed.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.playlistSong.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.lyrics.deleteMany();
  await prisma.song.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database tables.');

  // 2. Seed Users
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const userPasswordHash = await bcrypt.hash('User@123456', 10);

  const admin = await prisma.user.create({
    data: {
      username: 'MusicWaveAdmin',
      email: 'admin@musicwave.com',
      passwordHash,
      role: 'ADMIN',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      bio: 'Lead Administrator & Audio Architect at MusicWave.',
    },
  });

  const demoUsersData = [
    { username: 'AlexVibe', email: 'alex@musicwave.com', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300' },
    { username: 'SophiaHarmonics', email: 'sophia@musicwave.com', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300' },
    { username: 'LiamBeats', email: 'liam@musicwave.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300' },
    { username: 'EmmaAcoustic', email: 'emma@musicwave.com', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300' },
    { username: 'NoahSynth', email: 'noah@musicwave.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300' },
    { username: 'OliviaRhythm', email: 'olivia@musicwave.com', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300' },
    { username: 'LucasEcho', email: 'lucas@musicwave.com', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300' },
    { username: 'MiaMelody', email: 'mia@musicwave.com', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300' },
    { username: 'EthanBass', email: 'ethan@musicwave.com', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300' },
    { username: 'ChloeGroove', email: 'chloe@musicwave.com', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300' },
  ];

  const demoUsers = [];
  for (const u of demoUsersData) {
    const user = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        passwordHash: userPasswordHash,
        avatarUrl: u.avatar,
        bio: `Music enthusiast & playlist curator | Loving high fidelity sound.`,
      },
    });
    demoUsers.push(user);
  }
  console.log(`👤 Created Admin and ${demoUsers.length} users.`);

  // 3. Seed Genres
  const genresData = [
    { name: 'Electronic', slug: 'electronic', color: '#8b5cf6', coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' },
    { name: 'Lo-Fi & Chill', slug: 'lo-fi', color: '#ec4899', coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500' },
    { name: 'Synthwave', slug: 'synthwave', color: '#06b6d4', coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },
    { name: 'Pop Hits', slug: 'pop', color: '#f59e0b', coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' },
    { name: 'Hip-Hop & R&B', slug: 'hip-hop', color: '#10b981', coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500' },
    { name: 'Indie & Rock', slug: 'indie-rock', color: '#ef4444', coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500' },
    { name: 'Ambient & Deep', slug: 'ambient', color: '#6366f1', coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' },
    { name: 'Jazz & Soul', slug: 'jazz', color: '#d97706', coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=500' },
  ];

  const genres: Record<string, any> = {};
  for (const g of genresData) {
    const genre = await prisma.genre.create({ data: g });
    genres[g.slug] = genre;
  }
  console.log(`🎨 Created ${genresData.length} genres.`);

  // 4. Seed Artists
  const artistsData = [
    {
      name: 'Aetheria Night',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400',
      biography: 'Electronic music producer blending futuristic ambient soundscapes with hypnotic deep basslines.',
      verified: true,
      country: 'Sweden',
      monthlyListeners: 1420000,
    },
    {
      name: 'Neon Horizon',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1400',
      biography: 'Pioneer of the modern Synthwave and Cyberpunk resurgence. Known for vintage analog synthesizers.',
      verified: true,
      country: 'France',
      monthlyListeners: 2350000,
    },
    {
      name: 'Luna Solis',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=1400',
      biography: 'Multi-instrumentalist singer-songwriter crafting dreamy lo-fi vibes and soulful acoustic melodies.',
      verified: true,
      country: 'United States',
      monthlyListeners: 1890000,
    },
    {
      name: 'Pulse Syndicate',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1400',
      biography: 'Chart-topping electronic dance duo known for stadium anthems and infectious festival energy.',
      verified: true,
      country: 'Netherlands',
      monthlyListeners: 3100000,
    },
    {
      name: 'Kairos Wave',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1400',
      biography: 'Cinematic chillout & ambient architect providing focus music for millions of deep thinkers.',
      verified: true,
      country: 'Japan',
      monthlyListeners: 980000,
    },
    {
      name: 'Valerie Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1400',
      biography: 'Contemporary R&B and Neo-Soul vocalist with velvety tones and poetic lyricism.',
      verified: true,
      country: 'United Kingdom',
      monthlyListeners: 1650000,
    },
    {
      name: 'The Midnight Echoes',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=1400',
      biography: 'Indie rock outfit weaving nostalgic 80s guitars with crisp modern pop sensibilities.',
      verified: true,
      country: 'Canada',
      monthlyListeners: 1200000,
    },
    {
      name: 'K-Flow & Sol',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1400',
      biography: 'Urban hip-hop innovators delivering razor-sharp lyrical flows over melodic soul samples.',
      verified: true,
      country: 'United States',
      monthlyListeners: 2800000,
    },
    {
      name: 'Aurora Borealis',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400',
      biography: 'Ethereal dreampop artist combining atmospheric reverbs with haunting vocal hooks.',
      verified: true,
      country: 'Norway',
      monthlyListeners: 1150000,
    },
    {
      name: 'Tokyo Sunset Club',
      avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500',
      bannerUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=1400',
      biography: 'City Pop and Future Funk collective celebrating Tokyo nightlights and retro groove aesthetics.',
      verified: true,
      country: 'Japan',
      monthlyListeners: 1720000,
    },
  ];

  const artists: Record<string, any> = {};
  for (const a of artistsData) {
    const artist = await prisma.artist.create({ data: a });
    artists[a.name] = artist;
  }
  console.log(`🎤 Created ${artistsData.length} verified artists.`);

  // 5. Seed Albums
  const albumsData = [
    {
      title: 'Celestial Odyssey',
      artistName: 'Aetheria Night',
      genreSlug: 'electronic',
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
      description: 'A transcendent journey across stellar frequencies and cosmic resonance.',
    },
    {
      title: 'Retrograde 1984',
      artistName: 'Neon Horizon',
      genreSlug: 'synthwave',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
      description: 'High-octane synthwave packed with analog warm synths and cruising rhythms.',
    },
    {
      title: 'Midnight Coffee & Rain',
      artistName: 'Luna Solis',
      genreSlug: 'lo-fi',
      coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600',
      description: 'Warm vinyl crackles, gentle electric pianos and soothing rain drops.',
    },
    {
      title: 'Electric Euphoria',
      artistName: 'Pulse Syndicate',
      genreSlug: 'electronic',
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
      description: 'High energy festival tracks and melodic club anthems for the endless dancefloor.',
    },
    {
      title: 'Deep Focus & Zen',
      artistName: 'Kairos Wave',
      genreSlug: 'ambient',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
      description: 'Immersive soundscapes designed for flow state, meditation, and calm.',
    },
    {
      title: 'Velvet Hour',
      artistName: 'Valerie Vance',
      genreSlug: 'jazz',
      coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600',
      description: 'Intimate late-night jazz chords and golden soulful vocals.',
    },
    {
      title: 'Neon Boulevard',
      artistName: 'The Midnight Echoes',
      genreSlug: 'indie-rock',
      coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600',
      description: 'Driving indie rock melodies for midnight road trips under streetlights.',
    },
    {
      title: 'Crown & Culture',
      artistName: 'K-Flow & Sol',
      genreSlug: 'hip-hop',
      coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600',
      description: 'Crisp drums, soul brass samples, and conscious storytelling.',
    },
    {
      title: 'Northern Lights Glow',
      artistName: 'Aurora Borealis',
      genreSlug: 'pop',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      description: 'Atmospheric pop hooks infused with Nordic clarity and lush harmonies.',
    },
    {
      title: 'Shibuya Sunset Grooves',
      artistName: 'Tokyo Sunset Club',
      genreSlug: 'pop',
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600',
      description: 'Breezy City Pop guitars and disco funk basslines from the heart of Tokyo.',
    },
    {
      title: 'Sub Zero Basslines',
      artistName: 'Aetheria Night',
      genreSlug: 'electronic',
      coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600',
      description: 'Dark minimal techno and atmospheric club pressure.',
    },
    {
      title: 'Cyber Drive 2099',
      artistName: 'Neon Horizon',
      genreSlug: 'synthwave',
      coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600',
      description: 'The definitive sonic blueprint for futuristic highway speed.',
    },
  ];

  const albums: Record<string, any> = {};
  for (const alb of albumsData) {
    const artist = artists[alb.artistName];
    const genre = genres[alb.genreSlug];
    const album = await prisma.album.create({
      data: {
        title: alb.title,
        coverUrl: alb.coverUrl,
        description: alb.description,
        artistId: artist.id,
        genreId: genre?.id || null,
      },
    });
    albums[alb.title] = album;
  }
  console.log(`💿 Created ${albumsData.length} albums.`);

  // 6. Reliable Public Royalty-Free Audio Stream URLs (Internet Archive / Free CDNs)
  const audioStreams = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
  ];

  // 7. Seed 50+ Full-Featured Songs with Synced Lyrics
  const songsData = [
    // Celestial Odyssey
    { title: 'Starlight Transmission', artist: 'Aetheria Night', album: 'Celestial Odyssey', genre: 'electronic', duration: 245, trending: true, featured: true },
    { title: 'Orbiting Jupiter', artist: 'Aetheria Night', album: 'Celestial Odyssey', genre: 'electronic', duration: 218, trending: true, featured: false },
    { title: 'Gravity Well', artist: 'Aetheria Night', album: 'Celestial Odyssey', genre: 'electronic', duration: 195, trending: false, featured: false },
    { title: 'Nebula Dreaming', artist: 'Aetheria Night', album: 'Celestial Odyssey', genre: 'electronic', duration: 260, trending: false, featured: true },

    // Retrograde 1984
    { title: 'Neon Highway 84', artist: 'Neon Horizon', album: 'Retrograde 1984', genre: 'synthwave', duration: 232, trending: true, featured: true },
    { title: 'Sunset Drive Overpass', artist: 'Neon Horizon', album: 'Retrograde 1984', genre: 'synthwave', duration: 210, trending: true, featured: false },
    { title: 'Laser Grid Romance', artist: 'Neon Horizon', album: 'Retrograde 1984', genre: 'synthwave', duration: 240, trending: false, featured: false },
    { title: 'Midnight Arcade', artist: 'Neon Horizon', album: 'Retrograde 1984', genre: 'synthwave', duration: 188, trending: false, featured: true },

    // Midnight Coffee & Rain
    { title: 'Coffee Stains & Chill', artist: 'Luna Solis', album: 'Midnight Coffee & Rain', genre: 'lo-fi', duration: 175, trending: true, featured: true },
    { title: 'Raindrops on the Window', artist: 'Luna Solis', album: 'Midnight Coffee & Rain', genre: 'lo-fi', duration: 190, trending: false, featured: false },
    { title: 'Study Beats at 2AM', artist: 'Luna Solis', album: 'Midnight Coffee & Rain', genre: 'lo-fi', duration: 165, trending: true, featured: false },
    { title: 'Quiet Rooftop Sunset', artist: 'Luna Solis', album: 'Midnight Coffee & Rain', genre: 'lo-fi', duration: 205, trending: false, featured: true },

    // Electric Euphoria
    { title: 'Festival Lights Glow', artist: 'Pulse Syndicate', album: 'Electric Euphoria', genre: 'electronic', duration: 215, trending: true, featured: true },
    { title: 'Bassline Drop Horizon', artist: 'Pulse Syndicate', album: 'Electric Euphoria', genre: 'electronic', duration: 198, trending: false, featured: false },
    { title: 'Lost in the Groove', artist: 'Pulse Syndicate', album: 'Electric Euphoria', genre: 'electronic', duration: 224, trending: true, featured: false },
    { title: 'Sunrise Afterparty', artist: 'Pulse Syndicate', album: 'Electric Euphoria', genre: 'electronic', duration: 250, trending: false, featured: true },

    // Deep Focus & Zen
    { title: 'Breathe with Water', artist: 'Kairos Wave', album: 'Deep Focus & Zen', genre: 'ambient', duration: 280, trending: false, featured: true },
    { title: 'Floating Cloud Mind', artist: 'Kairos Wave', album: 'Deep Focus & Zen', genre: 'ambient', duration: 310, trending: false, featured: false },
    { title: 'Forest Temple Bells', artist: 'Kairos Wave', album: 'Deep Focus & Zen', genre: 'ambient', duration: 240, trending: false, featured: false },
    { title: 'Deep Horizon Silence', artist: 'Kairos Wave', album: 'Deep Focus & Zen', genre: 'ambient', duration: 295, trending: false, featured: true },

    // Velvet Hour
    { title: 'Velvet Midnight Wine', artist: 'Valerie Vance', album: 'Velvet Hour', genre: 'jazz', duration: 230, trending: true, featured: true },
    { title: 'Smoky Bar Chords', artist: 'Valerie Vance', album: 'Velvet Hour', genre: 'jazz', duration: 212, trending: false, featured: false },
    { title: 'Whisper in My Ear', artist: 'Valerie Vance', album: 'Velvet Hour', genre: 'jazz', duration: 245, trending: true, featured: false },
    { title: 'Slow Dance Under Lamps', artist: 'Valerie Vance', album: 'Velvet Hour', genre: 'jazz', duration: 220, trending: false, featured: true },

    // Neon Boulevard
    { title: 'Streetlight Serenade', artist: 'The Midnight Echoes', album: 'Neon Boulevard', genre: 'indie-rock', duration: 205, trending: true, featured: true },
    { title: 'Echoes in the Rain', artist: 'The Midnight Echoes', album: 'Neon Boulevard', genre: 'indie-rock', duration: 195, trending: false, featured: false },
    { title: 'City Lights Running', artist: 'The Midnight Echoes', album: 'Neon Boulevard', genre: 'indie-rock', duration: 218, trending: false, featured: false },
    { title: 'Yesterday Tonight', artist: 'The Midnight Echoes', album: 'Neon Boulevard', genre: 'indie-rock', duration: 235, trending: false, featured: true },

    // Crown & Culture
    { title: 'Golden Hour Hustle', artist: 'K-Flow & Sol', album: 'Crown & Culture', genre: 'hip-hop', duration: 185, trending: true, featured: true },
    { title: 'Streets of Gold', artist: 'K-Flow & Sol', album: 'Crown & Culture', genre: 'hip-hop', duration: 210, trending: true, featured: false },
    { title: 'Rhymes & Rhythm', artist: 'K-Flow & Sol', album: 'Crown & Culture', genre: 'hip-hop', duration: 195, trending: false, featured: false },
    { title: 'Soul Brother Anthem', artist: 'K-Flow & Sol', album: 'Crown & Culture', genre: 'hip-hop', duration: 225, trending: false, featured: true },

    // Northern Lights Glow
    { title: 'Crystal Sky Aurora', artist: 'Aurora Borealis', album: 'Northern Lights Glow', genre: 'pop', duration: 215, trending: true, featured: true },
    { title: 'Nordic Echoes', artist: 'Aurora Borealis', album: 'Northern Lights Glow', genre: 'pop', duration: 202, trending: false, featured: false },
    { title: 'Frozen Heart Beats', artist: 'Aurora Borealis', album: 'Northern Lights Glow', genre: 'pop', duration: 228, trending: true, featured: false },
    { title: 'Midnight Sun Anthem', artist: 'Aurora Borealis', album: 'Northern Lights Glow', genre: 'pop', duration: 240, trending: false, featured: true },

    // Shibuya Sunset Grooves
    { title: 'Tokyo Love Cruise', artist: 'Tokyo Sunset Club', album: 'Shibuya Sunset Grooves', genre: 'pop', duration: 210, trending: true, featured: true },
    { title: 'Night Flight Haneda', artist: 'Tokyo Sunset Club', album: 'Shibuya Sunset Grooves', genre: 'pop', duration: 225, trending: false, featured: false },
    { title: 'Roppongi Discotheque', artist: 'Tokyo Sunset Club', album: 'Shibuya Sunset Grooves', genre: 'pop', duration: 198, trending: true, featured: false },
    { title: 'Sunset on the Bay', artist: 'Tokyo Sunset Club', album: 'Shibuya Sunset Grooves', genre: 'pop', duration: 232, trending: false, featured: true },

    // Sub Zero Basslines & Cyber Drive
    { title: 'Underground Frequency', artist: 'Aetheria Night', album: 'Sub Zero Basslines', genre: 'electronic', duration: 250, trending: false, featured: false },
    { title: 'Dark Matter Waves', artist: 'Aetheria Night', album: 'Sub Zero Basslines', genre: 'electronic', duration: 235, trending: true, featured: true },
    { title: 'Speed of Light 2099', artist: 'Neon Horizon', album: 'Cyber Drive 2099', genre: 'synthwave', duration: 245, trending: true, featured: true },
    { title: 'Digital Mirage', artist: 'Neon Horizon', album: 'Cyber Drive 2099', genre: 'synthwave', duration: 220, trending: false, featured: false },

    // Additional Singles & Hit Tracks
    { title: 'Summer Breeze Memory', artist: 'Luna Solis', album: null, genre: 'lo-fi', duration: 180, trending: true, featured: true },
    { title: 'Hyperspace Jump', artist: 'Pulse Syndicate', album: null, genre: 'electronic', duration: 210, trending: false, featured: true },
    { title: 'Soul Connection', artist: 'Valerie Vance', album: null, genre: 'jazz', duration: 240, trending: true, featured: false },
    { title: 'Chasing the Sunset', artist: 'The Midnight Echoes', album: null, genre: 'indie-rock', duration: 198, trending: false, featured: false },
    { title: 'Top Floor Symphony', artist: 'K-Flow & Sol', album: null, genre: 'hip-hop', duration: 205, trending: true, featured: true },
    { title: 'Emerald Dreams', artist: 'Aurora Borealis', album: null, genre: 'pop', duration: 215, trending: false, featured: true },
    { title: 'Neon Boulevard Cafe', artist: 'Tokyo Sunset Club', album: null, genre: 'pop', duration: 220, trending: true, featured: false },
  ];

  const songCovers = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
    'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600',
  ];

  const createdSongs = [];

  for (let i = 0; i < songsData.length; i++) {
    const s = songsData[i];
    const artist = artists[s.artist];
    const album = s.album ? albums[s.album] : null;
    const genre = genres[s.genre];
    const audioUrl = audioStreams[i % audioStreams.length];
    const coverUrl = album ? album.coverUrl : songCovers[i % songCovers.length];
    const playsCount = Math.floor(Math.random() * 45000) + 5000;

    // Synced lyrics JSON with realistic timestamps
    const syncedLyrics = JSON.stringify([
      { time: 0, text: `[Instrumental intro - ${s.title}]` },
      { time: 8, text: `Feel the rhythm in the dark, moving with the sound` },
      { time: 18, text: `Every heartbeat echoes through the silent crowd` },
      { time: 29, text: `Take my hand and let the melody surround` },
      { time: 42, text: `[Chorus] We are alive in the frequency` },
      { time: 54, text: `Riding the waves of infinity` },
      { time: 68, text: `Nothing can stop what we're meant to be` },
      { time: 82, text: `[Instrumental break]` },
      { time: 98, text: `Stars are falling through the neon city skies` },
      { time: 112, text: `I can see the future glowing in your eyes` },
      { time: 128, text: `[Guitar & Synth Solo]` },
      { time: 150, text: `[Chorus] We are alive in the frequency` },
      { time: 165, text: `Riding the waves of infinity` },
      { time: 180, text: `Forever in harmony...` },
    ]);

    const plainLyrics = `Feel the rhythm in the dark, moving with the sound\nEvery heartbeat echoes through the silent crowd\nTake my hand and let the melody surround\n\n[Chorus]\nWe are alive in the frequency\nRiding the waves of infinity\nNothing can stop what we're meant to be\n\nStars are falling through the neon city skies\nI can see the future glowing in your eyes\n\n[Chorus]\nWe are alive in the frequency\nRiding the waves of infinity\nForever in harmony...`;

    const song = await prisma.song.create({
      data: {
        title: s.title,
        artistId: artist.id,
        albumId: album ? album.id : null,
        genreId: genre ? genre.id : null,
        duration: s.duration,
        audioUrl,
        coverUrl,
        playsCount,
        isTrending: s.trending,
        isFeatured: s.featured,
        lyrics: {
          create: {
            plainLyrics,
            syncedLyrics,
            isSynced: true,
          },
        },
      },
    });

    createdSongs.push(song);
  }

  console.log(`🎶 Created ${createdSongs.length} songs with audio streams & synced lyrics.`);

  // 8. Seed Curated Playlists
  const curatedPlaylists = [
    {
      title: 'Top Hits 2026',
      description: 'The most streamed trending tracks across MusicWave right now.',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      user: admin,
      songIndices: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36],
    },
    {
      title: 'Late Night Lo-Fi Chill',
      description: 'Relaxing beats, vinyl warmth, and quiet night aesthetics.',
      coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600',
      user: demoUsers[0],
      songIndices: [8, 9, 10, 11, 42],
    },
    {
      title: 'Cyberpunk Drive & Neon',
      description: 'Synthwave, outrun, and dark electronic for midnight driving.',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
      user: demoUsers[1],
      songIndices: [4, 5, 6, 7, 40, 41],
    },
    {
      title: 'Deep Focus & Flow State',
      description: 'Ambient atmospheres for maximum productivity and clarity.',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
      user: demoUsers[2],
      songIndices: [16, 17, 18, 19],
    },
    {
      title: 'Velvet Soul & Jazz Cafe',
      description: 'Smooth vocals, mellow horns, and gentle late night chords.',
      coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600',
      user: demoUsers[3],
      songIndices: [20, 21, 22, 23, 44],
    },
    {
      title: 'Urban Hip-Hop Sessions',
      description: 'Hard-hitting beats, lyrical flow, and classic soul samples.',
      coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600',
      user: demoUsers[4],
      songIndices: [28, 29, 30, 31, 46],
    },
  ];

  for (const p of curatedPlaylists) {
    const playlist = await prisma.playlist.create({
      data: {
        title: p.title,
        description: p.description,
        coverUrl: p.coverUrl,
        userId: p.user.id,
        isPublic: true,
      },
    });

    for (let pos = 0; pos < p.songIndices.length; pos++) {
      const sIdx = p.songIndices[pos];
      if (createdSongs[sIdx]) {
        await prisma.playlistSong.create({
          data: {
            playlistId: playlist.id,
            songId: createdSongs[sIdx].id,
            position: pos,
          },
        });
      }
    }
  }

  console.log(`📑 Created ${curatedPlaylists.length} curated playlists.`);

  // 9. Pre-populate Favorites & Recently Played for Admin & Users
  for (let i = 0; i < 8; i++) {
    await prisma.favorite.create({
      data: {
        userId: admin.id,
        songId: createdSongs[i].id,
      },
    });

    await prisma.recentlyPlayed.create({
      data: {
        userId: admin.id,
        songId: createdSongs[i].id,
        durationPlayed: 180,
      },
    });
  }

  // Pre-populate follows for admin
  const allArtists = Object.values(artists);
  for (let i = 0; i < 4; i++) {
    await prisma.follower.create({
      data: {
        userId: admin.id,
        artistId: allArtists[i].id,
      },
    });
  }

  console.log('✅ MusicWave Database Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
