# TODOs

- We need some mechanism to lock the data each year. In other words, folks should not be able to go and raise the game count (by playing the game) or increment the counter on Nov. 1. Perhaps some kind of "frozen mode" with wording like "xxx days until Halloween" and a countdown timer if the date in PDT is not Oct. 31. We need to be able to override this so that we can develop new features throughout the year (perhaps via an existing token).

## Ideas

- wdyt about adding integration tests - would that provide any benfit to this application? you can say no.

## Nice to haves

- Currently the APIs to query the database are open APIs - which I think is fine for now. However, the server for the app is extremely small and could be easily overrun with requests from a bad actor. Investigate options and rate limiting. Monetary cost is very important here. We do not want to be paying a lot of money for a hosting simple and fun toy app.
