// Hand-checked corrections the filename rules in lib/transform.mjs can't
// work out, keyed by source identifier, then file name (last path segment).
// Found by reviewing every clip with scripts/audit-library.mjs.

// Display titles that replace the cleaned-up filename: misspellings,
// mangled punctuation, cryptic codes ("TACS", "TMSS"), and bare track names
// from Norm's 2006 album "Ridiculous" that don't say what they are.
export const TITLE_FIXES = {
  "NormMacDonaldArchive1": {
    "The Fantastic Four-392.mp4":
      "The Fantastic Four (Ridiculous, 2006)",
    "Stan + Lois-386.mp4":
      "Stan + Lois (Ridiculous, 2006)",
    "Tex Hooper-390.mp4":
      "Tex Hooper (Ridiculous, 2006)",
    "World's First Two Gay Guys-415.mp4":
      "World's First Two Gay Guys (Ridiculous, 2006)",
    "Gambling Sportscaster-29.mp4":
      "Gambling Sportscaster (Ridiculous, 2006)",
    "Half Time-33.mp4":
      "Half Time (Ridiculous, 2006)",
    "Two Minute Warning-411.mp4":
      "Two Minute Warning (Ridiculous, 2006)",
    "A Wonderful Afternoon Gone Awry-8.mp4":
      "A Wonderful Afternoon Gone Awry (Ridiculous, 2006)",
    "Burning Bed-12.mp4":
      "Burning Bed (Ridiculous, 2006)",
    "Girls, Girls, Girls-31.mp4":
      "Girls, Girls, Girls (Ridiculous, 2006)",
    "Do You Want A Sandwich Or Anything-27.mp4":
      "Do You Want a Sandwich or Anything (Ridiculous, 2006)",
    "You Do The Crime, You Do The Time-416.mp4":
      "You Do the Crime, You Do the Time (Ridiculous, 2006)",
    "The Twelve Days Of Christmas-407.mp4":
      "The Twelve Days of Christmas (Ridiculous, 2006)",
    "Hidden Track-34.mp4":
      "Hidden Track (Ridiculous, 2006)",
    "Norm Macdonald - Me Doing Standup (2011) - Full  Free Download, Borrow, and Streaming  Internet Archive.mp4":
      "Norm Macdonald – Me Doing Standup (2011) Full Special",
    "Norm Macdonald 2003.Mp4-63.mp4":
      "Norm Macdonald (2003)",
    "Jillian Barberie On Leno (W Norm Macdonald)-39.mp4":
      "Jillian Barberie on Leno (w/ Norm Macdonald)",
    "1 3 Joy Behar On Celeb Millionaire-1.mp4":
      "Joy Behar on Celebrity Millionaire (Part 1 of 3)",
    "My Interview With Norm Macdonald 10 26 2009 Ksnw-Tv-43.mp4":
      "My Interview with Norm Macdonald Oct 26, 2009 KSNW-TV",
    "Norm Macdonald And Conan O'brien 1 2-80.mp4":
      "Norm Macdonald and Conan O'Brien (Part 1 of 2)",
    "Norm Macdonald And Conan O'brien 2 2-81.mp4":
      "Norm Macdonald and Conan O'Brien (Part 2 of 2)",
    "Norm Macdonald As Earl Mcmanus Deuce Bigalow   European Gigolo-82.mp4":
      "Norm Macdonald as Earl McManus – Deuce Bigalow: European Gigolo",
    "Norm Macdonald Bootleg Stand Up # 1-142.mp4":
      "Norm Macdonald Bootleg Stand Up #1",
    "Norm Macdonald Compilation On W A A F (2)-172.mp4":
      "Norm Macdonald Compilation on WAAF",
    "Norm Macdonald Compilation On W A A F-173.mp4":
      "Norm Macdonald Compilation on WAAF",
    "Norm Macdonald in StreetSmarts - SafeAuto Insurance Commercial & WebTV Series (2).mp4":
      "Norm Macdonald in StreetSmarts – SafeAuto Insurance Commercial & WebTV Series",
    "Norm Macdonald in StreetSmarts - SafeAuto Insurance Commercial & WebTV Series.mp4":
      "Norm Macdonald in StreetSmarts – SafeAuto Insurance Commercial & WebTV Series",
    "Norm Macdonald Interview 2008 (98.7 The Peak-Phoenix, Az)-183.mp4":
      "Norm Macdonald Interview 2008 (98.7 The Peak, Phoenix, AZ)",
    "Norm Macdonald is Completely Honest on News Radio (1997) The Injury S02E22.mp4":
      "Norm Macdonald Is Completely Honest on NewsRadio (1997) 'The Injury' S02E22",
    "Norm Macdonald On Live 105 - Cbs Local-309.mp4":
      "Norm Macdonald on Live 105 CBS San Francisco (2006) Radio Interview",
    "Norm Macdonald on Match Game - 2 Episodes (2008) with Super Dave Osbourne, Sarah Silverman & more.mp4":
      "Norm Macdonald on Match Game – 2 Episodes (2008) with Super Dave Osborne, Sarah Silverman & More",
    "Norm Macdonald on Toucher vesves Rich (12-11-2014).mp4":
      "Norm Macdonald on Toucher & Rich (Dec 11, 2014)",
    "Norm Macdonald Huffpost Live Full Interview 07 22 15-274.mp4":
      "Norm Macdonald on HuffPost Live w/ Josh Zepps (Jul 22, 2015) 'What Would Seth Meyers Do' Full Interview",
    "B.S Report - Norm MacDonald (2011.04.13).mp4":
      "The B.S. Report w/ Bill Simmons – Norm Macdonald (Apr 13, 2011) Full Interview",
    "Norm Macdonald on What's So Funny podcast (2012) In-depth Interview with Guy MacPherson.mp4":
      "Norm Macdonald on What's So Funny Podcast (2012) In-Depth Interview with Guy MacPherson",
    "Norm Mcdonald  Gambling And Meat-364.mp4":
      "Norm Macdonald – Gambling and Meat",
    "Norm On Tacs Feb 7 2008 Pt 1-370.mp4":
      "Norm on The Adam Carolla Show (Feb 7, 2008) Pt 1",
    "Norm On Tacs Mar 5 2008 Pt 1-371.mp4":
      "Norm on The Adam Carolla Show (Mar 5, 2008) Pt 1",
    "Norm On Tacs Sep 11 2008 Pt 1-372.mp4":
      "Norm on The Adam Carolla Show (Sep 11, 2008) Pt 1",
    "Norm On Tacs Sep 20 2006 Pt 1-373.mp4":
      "Norm on The Adam Carolla Show (Sep 20, 2006) Pt 1",
    "Norm Roasts Bob Sagat-365.mp4":
      "Norm Roasts Bob Saget",
    "Norm Macdonald's First Letterman Apperance (1990) Stand up.mp4":
      "Norm Macdonald's First Letterman Appearance (1990) Stand Up",
    "Norm Macdonald On Dennis Miller Millenium Special-92.mp4":
      "Norm Macdonald on Dennis Miller Millennium Special",
    "Rob Schneider on Instagram “This is the lost sketch I did with the great Norm Macdonald that we wrote together, directed by Canadian Film maker Boon Collins, edited by…”.mp4":
      "Rob Schneider – The Lost Sketch He Wrote with Norm Macdonald (Directed by Boon Collins)",
    "Senior Skip Day (4 10) Movie Clip - What Are The Odds (2008) Hd-385.mp4":
      "Senior Skip Day (4/10) Movie Clip – What Are the Odds? (2008)",
    "Shaggy Dog Jokes w  Norm Macdonald -  Make a Wish A prelude to Tiny White Coffin..mp4":
      "Shaggy Dog Jokes w/ Norm Macdonald – Make a Wish (A Prelude to Tiny White Coffin)",
    "Norm Macdonald Talks To Bob Brian Part 1 (Oj, Chevy Chase, Norm's Brothers)-355.mp4":
      "Norm Macdonald Talks to Bob & Brian Part 1 (OJ, Chevy Chase, Norm's Brothers)",
    "Norm Macdonald Talks To Bob And Brian Part 2 (Elle Macpherson, Burt Reynolds, Espys)-356.mp4":
      "Norm Macdonald Talks to Bob & Brian Part 2 (Elle Macpherson, Burt Reynolds, ESPYs)",
    "Tmss Fox 2000 Martin Short As Jiminy Glick Interviews Norm-389.mp4":
      "The Martin Short Show (Fox, 2000) – Jiminy Glick Interviews Norm",
    "Norm Macdonald - Larry King Live 04-11-1998-58.mp4":
      "Norm Macdonald on Larry King Live w/ David Spade (Apr 11, 1998) – Larry Interviews Himself",
    "Comedians İn Cars Getting Coffee S09 E02 Norm Macdonald A Rusty Car İn The Rain.mp4":
      "Comedians in Cars Getting Coffee S09E02 – Norm Macdonald: A Rusty Car in the Rain",
    "Comedy - Nerdist Podcast - Episode #32  Norm Macdonald - Talk With Celebrity-17.mp4":
      "Nerdist Podcast – Episode #32 – Norm Macdonald",
    "2015 Saturday 11 4 Pst The Masters With Norm Macdonald-6.mp4":
      "The Masters with Norm Macdonald – Saturday 2015 (11–4 PST)",
    "Last Comic Standing S09 - Ep01 The Premiere - Part 01 HD Watch.mp4":
      "Last Comic Standing S09E01 – The Premiere – Part 01",
    "Norm Macdonald on Johnjay & Rich (2010) Norm discusses the Tonight Show debacle.mp4":
      "Norm Macdonald on JohnJay & Rich (2010) Norm Discusses the Tonight Show Debacle",
    "The Middle-Heck Men Talking-401.mp4":
      "The Middle – Heck Men Talking",
    "The Middle-Mike Bullied Rusty As A Child-402.mp4":
      "The Middle – Mike Bullied Rusty as a Child",
    "The Middle-Rusty  Cop !-403.mp4":
      "The Middle – Rusty Cop!",
    "The Middle-Rusty's House Burned Down-404.mp4":
      "The Middle – Rusty's House Burned Down",
    "Norm Macdonald on News 11 TV (St-Louis) Mr Big Shot Showbiz.mp4":
      "Norm Macdonald on News 11 TV (St. Louis) – Mr. Big Shot Showbiz",
    "Norm Macdonald on Good Day Live (2003) 'You look a little haggard'.mp4":
      "Norm Macdonald on Good Day Live (Oct 23, 2003) 'You Look a Little Haggard'",
    "Norm Macdonald Live In Portland - 2019 (Helium Comedy Club)-196.mp4":
      "Norm Macdonald Live at the Helium Comedy Club, Portland, OR (Apr 28, 2019)",
    "Norm Macdonald on the Tonight Show w  Jay Leno (Apr 1998) Mickey Mouse Story.mp4":
      "Norm Macdonald on the Tonight Show w/ Jay Leno (Apr 22, 1998) Mickey Mouse Story",
    "Norm Macdonald   David Letterman Mark Twain Award-96.mp4":
      "Norm Macdonald at David Letterman's Mark Twain Prize (2017)",
    "Norm Macdonald Interviews Robert Duvall-187.mp4":
      "Norm Macdonald Interviews Robert Duvall – Dennis Miller Show (2011) the Greatest Actor in the World",
    "Norm Macdonald Interviews Jim Downey-72.mp4":
      "Norm Macdonald Interviews Jim Downey – Dennis Miller Show (2008) Weekend Update Legends",
    "Norm Macdonald Live In Washington Dc (3 21 19)-206.mp4":
      "Norm Macdonald Live in Washington, DC (Mar 21, 2019)",
    "Norm Macdonald   The View   05 19 1999-50.mp4":
      "Norm Macdonald on The View (May 19, 1999) Full Appearance",
    "Norm Macdonald on The View (May 1999) Full Appearance Ridiculous.mp4":
      "Norm Macdonald on The View (May 19, 1999) Full Appearance",
  },
  "20210918_im_not_norm": {
    "20210716_Norm Macdonad on Piña colada & King of the Road.mp4":
      "Norm Macdonald on Piña Colada & King of the Road",
    "20191205_Norm Macdonald an his Mom.mp4":
      "Norm Macdonald and His Mom",
    "20201105_Norm Macdonald as Funny as Ever. Q & A with Fans.mp4":
      "Norm Macdonald as Funny as Ever. Q&A with Fans",
    "20201003_NORM MACDONALD has FUN with BILLY JOE SHAVER (R.I.P.).mp4":
      "Norm Macdonald Has Fun with Billy Joe Shaver (R.I.P.)",
    "20190930_Norm Macdonald Htting on Ladies.mp4":
      "Norm Macdonald Hitting on Ladies",
    "20190814_Norm Macdonald on To Catch a Predator.mp4":
      "Norm Macdonald on To Catch a Predator",
    "20210401_Norm Macdondald is On Fire in this Interview.mp4":
      "Norm Macdonald Is on Fire in This Interview",
    "20210601_Norm on Serial Killer Joran van der Sloot.mp4":
      "Norm on Serial Killer Joran van der Sloot",
  },
};

// Clips that are the same video as another clip under a different name —
// matched by runtime (to the second, or within a few seconds where both
// titles name the same appearance). Each maps to the copy that is kept:
// the main archive's over a channel re-upload, otherwise the longer cut.
export const DUPLICATES = {
  "NormMacDonaldArchive1": {
    "Norm And Dr Chance-367.mp4":
      "NormMacDonaldArchive1/Norm Macdonald is feeling under the weather and visits Dr. Chance Burnbaum.mp4",
    "Grown Ups The Lost Tapes Of Norm Macdonald-32.mp4":
      "NormMacDonaldArchive1/Grown Ups - Norm Macdonald ends up on the cutting room floor (2010).mp4",
    "Norm Macdonald Talking About Hockey-231.mp4":
      "NormMacDonaldArchive1/Norm Macdonald & The Good Old Hockey Game (2011) NHL All-Access.mp4",
    "Norm Macdonald in Studio Q.mp4":
      "NormMacDonaldArchive1/Norm Macdonald on Studio Q (2015) CBC Full Interview.mp4",
    "Norm Macdonald On  Gdl - 2003 10 23-285.mp4":
      "NormMacDonaldArchive1/Norm Macdonald on Good Day Live (2003) 'You look a little haggard'.mp4",
    "Norm Macdonald Has Fun With Leno-44.mp4":
      "NormMacDonaldArchive1/Norm Macdonald on the Tonight Show w  Jay Leno (1997) Full Interview.mp4",
    "Norm Macdonald Doing Motion Capture (2)-174.mp4":
      "NormMacDonaldArchive1/Norm Macdonald in Beyond the Norm Making Of (2010) Vicon House of Moves.mp4",
    "Norm Macdonald Doing Motion Capture-175.mp4":
      "NormMacDonaldArchive1/Norm Macdonald in Beyond the Norm Making Of (2010) Vicon House of Moves.mp4",
    "Norm Macdonald @ Canadian Candy Awards 2016-65.mp4":
      "NormMacDonaldArchive1/Norm Macdonald hosts the 2016 Canadian Screen (Candy) Awards.mp4",
    "Norm Macdonald on Larry King Live - Larry Interviews Himself w  David Spade (1998).mp4":
      "NormMacDonaldArchive1/Norm Macdonald - Larry King Live 04-11-1998-58.mp4",
    "Best Hall Of Famer Nl Twitter Awards Norm Macdonald-10.mp4":
      "NormMacDonaldArchive1/Norm Macdonald gives a Post-Sasso Acceptance Speech (2011) NL Twitter Awards - Best Hall of Famer.mp4",
    "Norm Macdonald Live At The Helium Comedy Club, Portland Or 4 28 19-85.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Live In Portland - 2019 (Helium Comedy Club)-196.mp4",
    "Norm Macdonald On A E S Caroline S Comedy Hour-86.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Stand Up - Caroline's Comedy Hour (1991).mp4",
    "Norm Macdonald  On Jay Leno -  04 22 1998-52.mp4":
      "NormMacDonaldArchive1/Norm Macdonald on the Tonight Show w  Jay Leno (Apr 1998) Mickey Mouse Story.mp4",
    "Norm Macdonald Hosts Espys Sports Award Show 1998-70.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Hosts the ESPY Sports Awards (1998) Promo, Intro & Monologue.mp4",
    "Norm Macdonald Stand Up - Full Show - Washington Dc 2019-224.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Live In Washington Dc (3 21 19)-206.mp4",
    "Norm Macdonald on HuffPost Live (2015) 'What would Seth Meyers do' Full Interview with Josh Kepps.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Huffpost Live Full Interview 07 22 15-274.mp4",
    "Norm Macdonald - BS Report w  Bill Simmons (April 2011) Full Interview.mp4":
      "NormMacDonaldArchive1/B.S Report - Norm MacDonald (2011.04.13).mp4",
    "Norm Macdonald Interviews Jim Downey - Dennis Miller Show (2008) Weekend Update Legends.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Interviews Jim Downey-72.mp4",
  },
  "20210918_im_not_norm": {
    "20191007_For The Chance.mp4":
      "NormMacDonaldArchive1/Norm Macdonald is feeling under the weather and visits Dr. Chance Burnbaum.mp4",
    "20190423_Norm Macdonald in St  Louis.mp4":
      "NormMacDonaldArchive1/Norm Macdonald on News 11 TV (St-Louis) Mr Big Shot Showbiz.mp4",
    "20210609_Norm Macdonald was Wasted During an Interview.mp4":
      "20210918_im_not_norm/20201027_Norm Macdonald Intoxicated During a Radio Interview.mp4",
    "20191225_12 Days of Christmas by Norm Macdonald.mp4":
      "NormMacDonaldArchive1/The Twelve Days Of Christmas-407.mp4",
    "20191107_Norm Macdonald, Jon Stewart Talks About Issues in 1996 [Rare].mp4":
      "20210918_im_not_norm/20210619_Norm Macdonald and Jon Stewart 1996.mp4",
    "20200710_Norm Macdonald's Mark Twain Award Monologue.mp4":
      "NormMacDonaldArchive1/Norm Macdonald   David Letterman Mark Twain Award-96.mp4",
    "20191108_Let Me Lay Down on Top of Her.mp4":
      "NormMacDonaldArchive1/PokerNews reporter wants Norm Macdonald to lie down on top of her (2007) Full Interview.mp4",
    "20210103_Norm Macdonald's Legendary Bob Saget Roast.mp4":
      "NormMacDonaldArchive1/Norm Roasts Bob Sagat-365.mp4",
    "20200121_Norm Macdonald Disabled Pig Joke.mp4":
      "NormMacDonaldArchive1/Shaggy Dog Jokes w  Norm Macdonald - Heroic Pig.mp4",
    "20200124_Norm Macdonald Riddle Joke.mp4":
      "NormMacDonaldArchive1/Shaggy Dog Jokes with Norm Macdonald - Riddle for a Frenchman - CONAN 1999.mp4",
    "20210319_Norm Macdonald Interviewed Ann Coulter.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Interviews Ann Coulter - Dennis Miller Show (2008).mp4",
    "20210321_The Greatest Comedian Interviews the Greatest Actor in the World.mp4":
      "NormMacDonaldArchive1/Norm Macdonald Interviews Robert Duvall-187.mp4",
  },
  "NORMBOOTLEGS": {
    "Norm MacDonald on Caroline's Comedy Hour(360p).mp4":
      "NormMacDonaldArchive1/Norm Macdonald Stand Up - Caroline's Comedy Hour (1991).mp4",
  },
};
