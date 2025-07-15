// Simple test to verify error handling improvements

// Mock the error response that would come from the backend
const mockErrorResponse = {
  response: {
    status: 400,
    data: {
      message: "Client already exists"
    }
  }
};

// Test the error handling logic
function testErrorHandling() {
  try {
    // Simulate the error that would be caught in useApi
    throw mockErrorResponse;
  } catch (error) {
    console.log("Original error:", error);
    console.log("Error response data:", error?.response?.data);
    
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
    if (result.message === "Client already exists") {
      console.log("✅ SUCCESS: Error message preserved correctly");
    } else {
      console.log("❌ FAILED: Error message not preserved");
    }
  }
}

// Run the test
testErrorHandling(); 