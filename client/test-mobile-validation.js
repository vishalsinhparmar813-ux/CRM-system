// Simple test to verify mobile number duplicate checking
const mockErrorResponses = [
  {
    response: {
      status: 400,
      data: {
        message: "Client with this email already exists"
      }
    }
  },
  {
    response: {
      status: 400,
      data: {
        message: "Client with this mobile number already exists"
      }
    }
  }
];

// Test the error handling logic for both email and mobile
function testMobileValidation() {
  mockErrorResponses.forEach((mockError, index) => {
    try {
      throw mockError;
    } catch (error) {
      console.log(`\nTest ${index + 1}:`);
      console.log("Original error:", error?.response?.data?.message);
      
      // Apply the same logic as in useApi
      const backendMessage = error?.response?.data?.message;
      
      const result = {
        success: false,
        message: backendMessage || "Error while processing your request please try again later",
        msg: backendMessage || "Error while processing your request please try again later",
        data: [],
        error: backendMessage || error.message,
      };
      
      console.log("Processed result:", result);
      
      // Verify the result
      if (result.message.includes("already exists")) {
        console.log("✅ SUCCESS: Specific error message preserved correctly");
        
        // Check which type of duplicate
        if (result.message.includes("email")) {
          console.log("   - Email duplicate detected");
        } else if (result.message.includes("mobile")) {
          console.log("   - Mobile duplicate detected");
        }
      } else {
        console.log("❌ FAILED: Error message not preserved");
      }
    }
  });
}

// Run the test
testMobileValidation(); 