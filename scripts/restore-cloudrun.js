const base = "https://movie-club-app-354315661892.us-central1.run.app";

const sessions = [
  {
    id: "night-1",
    date: "2026-07-18T07:00:00.000Z",
    selector: "Max Smith",
    movieTitle: "The Lord of the Rings: The Return of the King",
    status: "watched",
    overview: {
      title: "Lord of the Rings - more like “Samwise Gamgee not getting the recognition he deserves!!!!”",
      content: "Kicking off our inaugural Movie Club screening with the grand finale of Peter Jackson's legendary trilogy. Samwise Gamgee carried the entire fellowship on his shoulders, and honestly, the emotional resonance of this masterpiece only deepens with time. An unforgettable start to our club nights with the gang.",
      imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "Max Smith", rating: 5, comment: "Peter Jackson's crowning achievement. 200 minutes flies by and the emotional punch never fades." },
      { user: "James Macintosh", rating: 5, comment: "The ride of the Rohirrim still gives me goosebumps every single time. Perfect opening film for our club." },
      { user: "Ash Macintosh", rating: 4.5, comment: "Samwise Gamgee is the true hero of Middle Earth. Jackson's scale remains unmatched 20+ years later." }
    ]
  },
  {
    id: "night-2",
    date: "2026-08-01T07:00:00.000Z",
    selector: "Ash Macintosh",
    movieTitle: "Prisoners",
    status: "watched",
    overview: {
      title: "Is Denis Villeneuve Lost in the Sauce?",
      content: "Tense, gripping, and relentlessly dark from the first frame to the final whistle. Hugh Jackman delivers a career-defining descent into parental desperation while Jake Gyllenhaal's twitchy Detective Loki grounds the mystery with pure grit. The moral ambiguity kept us debating well past midnight.",
      imageUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "Ash Macintosh", rating: 5, comment: "Villeneuve crafts pure dread and moral ambiguity. Hugh Jackman and Jake Gyllenhaal at their absolute peaks." },
      { user: "Max Smith", rating: 4.5, comment: "Hugh Jackman's bathroom hammer interrogation scene was pure intensity. Kept us debating for hours after." }
    ]
  },
  {
    id: "night-3",
    date: "2026-08-21T07:00:00.000Z",
    selector: "Madison Hill",
    movieTitle: "Heavenly Creatures",
    status: "watched",
    overview: {
      title: "The Christchurch Girls High Experience",
      content: "A haunting local treasure that hit close to home. The fantasy dream sequences and the incredible breakout performances from Kate Winslet and Melanie Lynskey made this one of our most stylistically unique evenings. Tragic, vivid, and deeply atmospheric New Zealand cinema.",
      imageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "Madison Hill", rating: 5, comment: "Kate Winslet and Melanie Lynskey's chemistry is unforgettable. Such a poetic yet chilling slice of NZ history." },
      { user: "Ash Macintosh", rating: 4.5, comment: "The clay world fantasy sequences set against Christchurch landscapes create something truly hypnotic." }
    ]
  },
  {
    id: "night-4",
    date: "2026-08-28T19:00:00",
    selector: "Amy Walsh",
    movieTitle: "Promising Young Woman",
    status: "watched",
    overview: {
      title: "Promise you’ll only notice Bo Burnham’s Giant Dome",
      content: "Carey Mulligan commands every scene with razor-sharp precision. The candy-colored aesthetic clashing against the biting, uncompromising revenge narrative left all of us stunned. A pitch-perfect modern thriller with an explosive soundtrack to match.",
      imageUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "Amy Walsh", rating: 5, comment: "That Toxic strings sequence was iconic! Carey Mulligan delivers vengeance with terrifying elegance." },
      { user: "James Macintosh", rating: 4.5, comment: "Sharp, subversive writing and a gut-punch finale that none of us anticipated. Terrific pick by Amy." }
    ]
  },
  {
    id: "night-5",
    date: "2026-09-11T19:00:00",
    selector: "Tom Sakai",
    movieTitle: "Parasite",
    status: "watched",
    overview: {
      title: "Fannies, Crips, and (9/)11 Chips",
      content: "Pure cinematic perfection. Bong Joon Ho orchestrates genre shifts with breathtaking elegance—hilarious satire in the first half leading into unbearable suspense in the basement. Every single member was on the edge of their seat. Unquestionably one of our highest-rated nights.",
      imageUrl: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "Tom Sakai", rating: 5, comment: "Bong Joon Ho's pacing and tone control is masterclass. Every scene transition is pure cinematic gold." },
      { user: "Ash Macintosh", rating: 5, comment: "The basement reveal and that rain-soaked descent back to the semi-basement apartment—flawless filmmaking." }
    ]
  },
  {
    id: "night-6",
    date: "2026-09-25T19:00:00",
    selector: "James Macintosh",
    movieTitle: "The King of Kong: A Fistful of Quarters",
    status: "watched",
    overview: {
      title: "An Ode to Steve Wiebe - Our Autistic King of Kong",
      content: "You couldn't script better characters than Steve Wiebe and Billy Mitchell if you tried. The quintessential David versus Goliath documentary that had the entire room cheering for every single hammer smash and barrel jump. An absolute crowd pleaser that exceeded all expectations.",
      imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "James Macintosh", rating: 5, comment: "Billy Mitchell walking in with the USA tie while Steve Wiebe sweats at the arcade is peak comedy." },
      { user: "Max Smith", rating: 4.5, comment: "Funniest documentary we've ever watched. The entire room was shouting at the screen during the kill screen." }
    ]
  },
  {
    id: "night-7",
    date: "2026-10-09T19:00:00",
    selector: "Max Smith",
    movieTitle: "The Long Walk",
    status: "watched",
    overview: {
      title: "But, how do they shit?",
      content: "It’s tough to keep an audience engaged when a film is set in one location. Although this film does technically travel through fictional America, the road they walk is essentially one setting they never leave. To make it even harder for the director, we as the audience immediately know that all but one of the cast members will likely die. To overcome these there is a HEAVY reliance on the actors and the writing but its masterfully done in all aspects. The way they managed to get me to care so deeply about even the most despicable characters right before their demise by breaking them down, finally showing their true vulnerability was heartbreaking and so human. I will also say the plot twist at the end was a really left field hook I didn’t see coming so kudos to Stephen King on that one. 4.5/5 with the only draw back being the final scene felt like it had less weight than some of the previous deaths.",
      imageUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80"
    },
    reviews: [
      { user: "Ash Macintosh", rating: 4.5, comment: "It’s tough to keep an audience engaged when a film is set in one location. Stephen King's tension brought to life masterfully." },
      { user: "Max Smith", rating: 4.5, comment: "Stephen King's dystopian road walk brought to life with brutal tension. Kept your heart pounding until the last mile." }
    ]
  },
  {
    id: "night-8",
    date: "2026-10-23T19:00:00",
    selector: "Ash Macintosh",
    movieTitle: "Wildwood",
    status: "scheduled"
  }
];

const recipients = [
  { email: "james.mac333@gmail.com", name: "James Macintosh" },
  { email: "ash.masons@gmail.com", name: "Ash Macintosh" },
  { email: "zalaloom@gmail.com", name: "Tom Sakai" },
  { email: "mineacrepig@gmail.com", name: "Max Smith" },
  { email: "madihill1998@gmail.com", name: "Madison Hill" },
  { email: "amy.walsh789@gmail.com", name: "Amy Walsh" }
];

async function run() {
  console.log("Starting full database restoration on Cloud Run...");

  // 1. Temporarily clear recipients so no email notifications are fired during bulk sync
  try {
    const edmRes = await fetch(`${base}/api/edm`);
    const edmData = await edmRes.json();
    for (const r of (edmData.recipients || [])) {
      await fetch(`${base}/api/edm/recipients`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: r.email, requester: "james" })
      });
    }
    console.log("✓ EDM distribution temporarily muted during restoration");
  } catch (e) {
    console.warn("Could not mute recipients:", e.message);
  }

  // 2. Restore all sessions, movies, dates, selectors, and overviews
  for (const s of sessions) {
    console.log(`Restoring session ${s.id} (${s.movieTitle})...`);

    // Date
    await fetch(`${base}/api/nights/${s.id}/date`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: s.date, requester: "james" })
    });

    // Selector
    await fetch(`${base}/api/nights/${s.id}/selector`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selector: s.selector, requester: "james", realignSubsequent: false })
    });

    // Movie details
    if (s.movieTitle) {
      await fetch(`${base}/api/nights/${s.id}/movie`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieTitle: s.movieTitle, requester: "james" })
      });
    }

    // Status
    await fetch(`${base}/api/nights/${s.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s.status, requester: "james" })
    });

    // Overview
    if (s.overview) {
      await fetch(`${base}/api/overviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieNightId: s.id,
          title: s.overview.title,
          content: s.overview.content,
          imageUrl: s.overview.imageUrl,
          requester: "ash"
        })
      });
    }

    // Reviews
    if (s.reviews) {
      for (const r of s.reviews) {
        await fetch(`${base}/api/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movieNightId: s.id,
            user: r.user,
            rating: r.rating,
            comment: r.comment
          })
        });
      }
    }
  }

  // 3. Restore all 6 recipients
  for (const r of recipients) {
    await fetch(`${base}/api/edm/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: r.email, name: r.name, requester: "james" })
    });
  }
  console.log("✓ All 6 club EDM recipients re-armed");

  // 4. Verify live data
  const nightsRes = await fetch(`${base}/api/nights`);
  const nights = await nightsRes.json();
  const reviewsRes = await fetch(`${base}/api/reviews`);
  const reviews = await reviewsRes.json();
  const overviewsRes = await fetch(`${base}/api/overviews`);
  const overviews = await overviewsRes.json();

  console.log("Restoration Complete!");
  console.log(`- Nights: ${nights.length} (Watched: ${nights.filter(n=>n.status==='watched').length})`);
  console.log(`- Reviews: ${reviews.length}`);
  console.log(`- Overviews: ${overviews.length}`);
}

run().catch(console.error);
