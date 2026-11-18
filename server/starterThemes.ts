// The club's first list of rotation themes. Added once, the first time the server starts with
// theme support (when the database has never had a theme list). After that, admins manage them on the site.
export const STARTER_THEMES: Array<{ name: string; description: string }> = [
  { name: "Creature Feature", description: "Monsters, aliens, giant beasts or things that go bump in the night. If it has claws, tentacles or too many teeth, it counts." },
  { name: "Childhood Nostalgia", description: "Take us back to your childhood with a movie you loved growing up. Bonus points if it hasn't aged particularly well." },
  { name: "So Bad It's Good", description: "A movie that's technically terrible but somehow an absolute masterpiece of entertainment." },
  { name: "Biggest Plot Twist", description: "A movie that completely pulls the rug out from under you. No spoilers!" },
  { name: "All-Time Favourite", description: "Your personal number one. The movie you'd happily recommend to absolutely anyone." },
  { name: "First Movie to Scare Me", description: "The movie that traumatised you as a kid, gave you nightmares or made you sleep with the lights on." },
  { name: "Oscar Winner", description: "Pick a movie that's taken home an Academy Award. Any category, any year." },
  { name: "The Weirdest Movie You've Ever Seen", description: "Something bizarre, surreal, uncomfortable or downright difficult to explain." },
  { name: "Box Office Disaster", description: "A movie that bombed at the box office. Whether it's a misunderstood masterpiece or an absolute trainwreck is up to you." },
  { name: "Your Guilty Pleasure", description: "A movie you absolutely love but might be slightly embarrassed to admit it." },
  { name: "One-Location Movie", description: "The entire movie takes place in one primary location. Let's see what filmmakers can do with limited space." },
  { name: "Released Before You Were Born", description: "Take us back in time with a movie released before you entered the world." },
  { name: "Emotional Rollercoaster", description: "A movie that takes you through every possible emotion. Bring tissues, if necessary." },
  { name: "Whatever You Want", description: "No rules, no restrictions. Pick absolutely anything you fancy." },
  { name: "Blockbuster Franchise", description: "Bring us a movie from a major film franchise. Sequels, prequels, spin-offs and cinematic universes all welcome." },
  { name: "Independent Film", description: "Something made outside the traditional big Hollywood studio system. Time to discover a hidden gem." },
  { name: "One-Word Title", description: "The title must be exactly one word. Simple enough, right?" },
  { name: "The Most Ridiculous Premise", description: "A movie with a storyline so absurd that you wonder how anyone got it greenlit." },
  { name: "Cult Classic", description: "A movie with a dedicated following, unconventional appeal or a reputation that has grown over time." },
  { name: "Based on a True Story", description: "A movie inspired by real people, events or historical moments. Accuracy is optional!" },
  { name: "Foreign Language Film", description: "Bring something from outside the English-speaking world. Subtitles are your friend." },
  { name: "Truth Is Stranger Than Fiction", description: "A documentary that explores something so bizarre, fascinating or unbelievable that you couldn't make it up." }
];
