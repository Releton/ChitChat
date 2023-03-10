const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 3000;
const ImageKit = require("imagekit");
require("dotenv").config();
const cors = require("cors");
const bcrypt = require('bcrypt')


app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "https://chitchat-lilac.vercel.app",
  })
);

const apiDetection = (req, res, next) => {
  bcrypt.compare(req.headers.key, process.env.API_KEY, (err, result)=>{
    if(result){
      next()
    }
    else{
      res.status(401).json({message: "Unauthorized"})
    }
  })
}

app.use(apiDetection)

const imageKit = new ImageKit({
  publicKey: process.env.PUBLIC_KEY,
  privateKey: process.env.PRIVATE_KEY,
  urlEndpoint: process.env.URL_ENDPOINT,
});

mongoose.connect(process.env.MONGODB_CONNECTION);

//User schema
const UserSchema = mongoose.Schema({
  name: {
    required: true,
    type: String,
  },
  email: String,
  image: {
    type: String,
  },
});
//User MOdel

const User = mongoose.model("User", UserSchema);

const commentSchema = mongoose.Schema({
  content: String,
  postedBy: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
});

const Comment = mongoose.model("comments", commentSchema);

//Chit schema
const chitSchema = mongoose.Schema({
  heading: {
    required: true,
    type: String,
  },
  content: {
    required: true,
    type: String,
  },
  thumbnail: String,
  imageId: String,
  postedBy: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
  comment: {
    type: [mongoose.Types.ObjectId],
    ref: "Comment",
  },
});

const Chit = mongoose.model("chits", chitSchema);

app.use(bodyParser.urlencoded({ extended: false }));

app
  .route("/user")
  .get(async (req, res) => {
    try {
      const users = await User.find({});
      res.status(200).json({
        success: true,
        users: users,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error,
      });
    }
  })
  .post(async (req, res) => {
    try {
      if (!req.body.name) {
        return res.status(400).json({
          success: false,
          message: "Name field cannot be empty",
        });
      }
      let user = await User.find({ email: req.body.email });
      if (user.length) {
        return res.status(200).json({
          user,
        });
      }

      if (!user.length) {
        imageKit.upload(
          {
            file: req.body.image,
            fileName: req.body.name + ".jpg",
            useUniqueFileName: true,
          },
          async (err, result) => {
            if (err) return
            user = await User.create({
              name: req.body.name,
              email: req.body.email,
              image: result.thumbnailUrl,
            });
            return res.status(200).json({
              user,
            });
          }
        );
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error,
      });
    }
  })
  .delete(async (req, res) => {
    try {
      await User.deleteMany({});
      res.status(200).json({
        success: true,
        message: "Deleted all users successfully",
      });
    } catch (e) {
      res.status(400).json({
        success: false,
        message: "Failed to delete",
      });
    }
  });

app
  .route("/user/:id")
  .get(async (req, res) => {
    try {
      const _id = req.params.id;
      const user = await User.findById({ _id });
      if (!user) throw new Error("No users found");
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error,
      });
    }
  })
  .patch(async (req, res) => {
    try {
      const user = await User.updateOne(
        { _id: req.params.id },
        { $set: req.body }
      );
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error,
      });
    }
  })
  .delete(async (req, res) => {
    try {
      await User.deleteOne({ _id: req.params.id });
      res.status(200).json({
        success: true,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error,
      });
    }
  });

app.get("/auth", (req, res) => {
  const result = imageKit.getAuthenticationParameters();
  res.send(result);
});

app
  .route("/chit")
  .get(async (req, res) => {
    try {
      const response = await Chit.find({}).populate("postedBy");
      res.status(200).json({
        success: true,
        chits: response,
      });
    } catch (e) {
      res.status(500).send("Internal server error");
    }
  })
  .post(async (req, res) => {
    try {
      await Chit.create({ ...req.body });
    } catch (e) {
      res.status(500).send("Internal server error");
    }
  })
  .delete(async (req, res) => {
    try {
      await Chit.deleteMany({});
      res.status(200).send("successfuly deleted the file");
    } catch (error) {
      res.status(400).send("Could not delete the file");
    }
  });

app
  .route("/chit/:id")
  .get(async (req, res) => {
    try {
      const chits = await Chit.findById(req.params.id).populate("postedBy");
      res.status(200).send(chits);
    } catch (error) {
      res.status(400).send(error);
    }
  })
  .patch(async (req, res) => {
    try {
      const set = req.body;
      await Chit.updateOne({ _id: req.params.id }, { $set: set });
      res.status(200).send("Success");
    } catch (error) {
      res.status(400).send(error);
    }
  })
  .delete(async (req, res) => {
    try {
      const toBeDeleted = await Chit.findById(req.params.id)
      if(toBeDeleted.imageId) {
        imageKit.deleteFile(toBeDeleted.imageId,async (err, result) => {
          await Chit.deleteOne({_id: toBeDeleted._id})
        })
      }

      else {
        await Chit.deleteOne({_id: toBeDeleted._id})
      }
      res.status(200).send("successfuly deleted the file");
    } catch (error) {
      res.status(400).send("Could not delete the file");
    }
  });

app.route("/search/:key").get(async (req, res) => {
  if (req.params.key === "user") {
    const profiles = await User.find({
      $or: [
        { email: { $regex: req.query?.key, $options: "i" } },
        { name: { $regex: req.query?.key, $options: "i" } },
      ],
    });
    res.status(200).json({ profiles });
  } else if (req.params.key === "chits") {
    const chits = await Chit.find({
      $or: [
        { heading: { $regex: req.query?.key, $options: "i" } },
        { content: { $regex: req.query?.key, $options: "i" } },
      ],
    }).populate('postedBy');
    res.status(200).json({ chits });
  } else {
    res.status(400).json({ message: "No such routes" });
  }
});

app.get("/chits/postedBy/:id", async (req, res) => {
  try{
    let chits
    if(!req.query.key){
      chits = await Chit.find({ postedBy: req.params.id}).populate('postedBy');
    }
    else {
      chits = await Chit.find({ postedBy: req.params.id,  $or: [
        { heading: { $regex: req.query?.key, $options: "i" } },
        { content: { $regex: req.query?.key, $options: "i" } },
      ]}).populate('postedBy');
    }
    res.status(200).json(chits)
  } catch (e) {
    res.status(400).json({e})
  }
});

app.listen(PORT, () => console.log("Started at port " + PORT));
exports = app