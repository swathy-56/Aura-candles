const passport=require('passport');
const GoogleStrategy=require('passport-google-oauth20').Strategy;
const User=require('../models/userSchema');
const env=require('dotenv').config();


console.log('client ID:',process.env.GOOGLE_CLIENT_ID);

passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'/auth/google/callback'
},

async (accessToken,refreshToken,profile,done)=>{
   try {
    console.log("🔍 Google profile received:", profile);
    let user=await User.findOne({googleId:profile.id});
    if(user){
        console.log("✅ User found in database:", user);
        return done(null,user);
    }else{
        console.log("⚠️ User not found, creating new user...");
        user=new User({
            name:profile.displayName,
            email:profile.emails[0].value,
            googleId:profile.id
        });
        await user.save();
        console.log("✅ New user created:", user);
        return done(null,user)
    }
   } catch (error) {
    console.error("❌ Error during Google Authentication:", error);
    return done(error,null)
   }
}
));

passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  
passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        console.log("🔄 Deserialized user:", user);
        done(null,user)

    })
    .catch(err=>{
        console.error("❌ Error during deserialization:", err);
       done(err,null)
    })
})

module.exports=passport;