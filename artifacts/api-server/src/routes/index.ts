import { Router, type IRouter } from "express";
import healthRouter from "./health";
import swapsRouter from "./swaps";
import swapPointsRouter from "./swap-points";
import adminRouter from "./admin";
import zeroxRouter from "./zerox";
import calculatorRouter from "./calculator";
import proxyImageRouter from "./proxy-image";
import robinhoodRpcRouter from "./robinhood-rpc";

const router: IRouter = Router();

router.use(healthRouter);
router.use(swapsRouter);
router.use(swapPointsRouter);
router.use("/admin", adminRouter);
router.use(zeroxRouter);
router.use(calculatorRouter);
router.use(proxyImageRouter);
router.use(robinhoodRpcRouter);

export default router;
