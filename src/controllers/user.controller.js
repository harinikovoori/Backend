import { asyncHandler } from "../utils/asyncHandler.js";

//Creat a Method
const registerUser = asyncHandler(async (req, res) =>{
     res.status(200).json({
        message : "HariniKovoori"
    })
})

export {registerUser}