import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/APIErrors.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/APIResponse.js";
import jwt from "jsonwebtoken";

//Method for access token and refrsh token

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating refresh and access token"
    );
  }
};

//Creat a Method
const registerUser = asyncHandler(async (req, res) => {
  // get user details
  // validation - not empty
  // check if user already exists through email/username
  // check for images, check for avatar
  // upload images to cloudinary
  // create an object - create an entry in db
  // remove password and refresh token field from response
  // check foe user creation
  // return response

  const { fullName, username, email, password } = req.body;
  //console.log("email: ", email);
  console.log("Register request body:", req.body);

  //validation
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //check if the user already exists either username or email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "user with this email or username already exists");
  }

  //console.log(req.files);

  //taking the images/pdfs/files from multer which are uploaded by the user

  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  //check whether avatar is uploaded or not
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //upload them to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  //check whether avatar is uploaded to cloudinary or not
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  //create object and enter the details to database
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  //check whether user is created or not
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken" // By default every field will be selected, so we are removing password and refreshToken from the object
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get the user data from req.body
  // check username or email and wheteher the data is empty
  // verify the user data with the data in the server (find whether user exist or not)
  // password check
  // access and refresh token
  // send secure cookies

  const { email, username, password } = req.body;
  console.log(email);

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "user does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //send cookies
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User looged Out"));
});

const refreshAccessToken = asyncHandler(async(req, res) =>{
    const incomeingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomeingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomeingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        if (incomeingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options = {
            httpOnly :true,
            secure : true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("RefreshToken", newrefreshToken, options)
        .json(
            new ApiResponse (
                200,
                {accessToken, refreshToken : newrefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message ||
        "Invalid refresh token"
        )
    }
});

const changeCurentPassword = asyncHandler(async (req, res) => {
    const {oldpassword, newpassword} = req.body
    
    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldpassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.passwpord =  newpassword
    await user.save({validateBeforeSave : false})

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    )
});

const getucurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully"
        )
    )
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const{fullName,email} =  req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

   const user = User.findByIdAndUpdate(
    req.user._id,
    {
        $set : {
            fullName,
            email
        }
    },
    {new : true}

).select("-password")
return res
.status(200)
.json(new ApiResponse(200, user, "Account details updated successfully"))

});

const updateUserAvatar = asyncHandler(async (req, res) => {

    count avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
        
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error While uploading avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set:{
                avatar : avatar.url
            }
        },
        {new :true}
    ).select("-paswword")

    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "Avatar updated successfully"
        )
    )

});

const updateUserCoverImage = asyncHandler(async (req, res) => {

    count coverImageLocalPath= req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "CoverImage file is missing")
        
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error While uploading coverImage")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set:{
                coverImage : coverImage.url
            }
        },
        {new :true}
    ).select("-paswword")

    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "CoverImage updated successfully"
        )
    )
});
export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurentPassword,
    getucurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage};
