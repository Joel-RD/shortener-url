import { Router, Response } from "express";
import { authJWT, requireActiveUser } from "../middleware/authJWT.js";
import { RequestModel as Request } from "../models/types.js";
import { AuthRepository } from "../repository/authRepository.js";
import { turso } from "../Database/databases.js";
import { sendOk } from "../utils/responseFormat.js";

const router = Router();
const authRepository = new AuthRepository(turso);

router.get(`/auth/user/profile`, authJWT, requireActiveUser(authRepository), (req: Request, res: Response) => {
    return sendOk(res, { user: { email: req.userEmail } }, "Perfil consultado correctamente");
});

export default router;
