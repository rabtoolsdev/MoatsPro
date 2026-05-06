import { Router, type IRouter } from "express";
import healthRouter from "./health";
import swapsRouter from "./swaps";
import adminRouter from "./admin";
import zeroxRouter from "./zerox";

const router: IRouter = Router();

router.use(healthRouter);
router.use(swapsRouter);
router.use("/admin", adminRouter);
router.use(zeroxRouter);

export default router;
