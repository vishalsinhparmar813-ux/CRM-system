const clientController = require('./clientController');

(async () => {
  try {
    await clientController.addOrderId(
      "7d680f41-5aa3-48e5-aa17-a000b573a49c",
      "165f475e-35b9-4e57-b587-d9743dd34f50"
    );
    console.log("Order ID pushed successfully.");
  } catch (err) {
    console.error("Error pushing order ID:", err);
  }
})();
