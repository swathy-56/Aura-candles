// import User from "../models/userSchema";
// const { HttpStatus } = require("../../shared/constants");

// export const checkUserBlocked = async (req, res, next) => {
//     try {
//       if (req.session && req.session.user) {
//         const user = await User.findById(req.session.user._id);
  
//         if (!user || user.isBlocked) {
//           req.session.user = null;
//           return res.redirect('/login?blocked=true');
//         }
//       }
//       next();
//     } catch (err) {
//       console.error('Error in checkUserBlocked middleware:', err);
//       res.status(HttpStatus.SERVER_ERROR).send('Internal Server Error');
//     }
//   };
  