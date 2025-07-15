import React from "react";
import Swal from "sweetalert2";
import Icon from "@/components/ui/Icon";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const DeleteOrder = ({ orderId, onDeleteSuccess }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();

  const handleDelete = async () => {
    Swal.fire({
      title: "Do you really want to delete this order?",
      showDenyButton: true,
      confirmButtonText: "Yes",
      denyButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const deleteResult = await apiCall(
            "DELETE",
            `order/${orderId}`,
            undefined,
            cookies.get("auth-token")
          );
          if (deleteResult.order && deleteResult) {
            onDeleteSuccess();
            Swal.fire("Order deleted successfully", "", "success");
          } else {
            Swal.fire(deleteResult.message || "Error deleting order", "", "error");
          }
        } catch (error) {
          Swal.fire("Error deleting order", "", "error");
        }
      }
    });
  };

  return (
    <div className="hover:cursor-pointer" onClick={handleDelete}>
      <Icon icon="fluent:delete-20-regular" width={25} />
    </div>
  );
};

export default DeleteOrder;
