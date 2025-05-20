import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/APIErrors.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/APIResponse.js";

//Creat a Method
const registerUser = asyncHandler(async (req, res) =>{
    // get user details 
    // validation - not empty
    // check if user already exists through email/username
    // check for images, check for avatar
    // upload images to cloudinary
    // create an object - create an entry in db
    // remove password and refresh token field from response
    // check foe user creation 
    // return response

    const {fullName, username, email, password} = req.body
    //console.log("email: ", email);

    //validation
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {  
        throw new ApiError(400, "All fields are required")
    }

    //check if the user already exists either username or email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409,"user with this email or username already exists")
    }

    //console.log(req.files);
    
    //taking the images/pdfs/files from multer which are uploaded by the user
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
        coverImageLocalPath = req.files.coverImage[0].path
    }


    //check whether avatar is uploaded or not
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    //check whether avatar is uploaded to cloudinary or not
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //create object and enter the details to database
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()

    })

    //check whether user is created or not 
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" // By default every field will be selected, so we are removing password and refreshToken from the object
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})

export {registerUser} 