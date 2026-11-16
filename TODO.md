# TODOs

- The game allows the same person to play it multiple times, but then their initials end up multiple times in the leaderboard. WDYT about only bumping their spot in the leaderboard up if they got a higher score than their previous one? We'd need a way to handle people with the same initials but different phones.

## Ideas

- wdyt about adding integration tests - would that provide any benfit to this application? you can say no.

## Nice to haves

- Currently the APIs to query the database are open APIs - which I think is fine for now. However, the server for the app is extremely small and could be easily overrun with requests from a bad actor. Investigate options and rate limiting. Monetary cost is very important here. We do not want to be paying a lot of money for a hosting simple and fun toy app.
