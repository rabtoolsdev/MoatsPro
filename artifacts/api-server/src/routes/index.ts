import { Router, type IRouter } from "express";
import healthRouter from "./health";
import swapsRouter from "./swaps";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(swapsRouter);
router.use("/admin", adminRouter);

export default router;
