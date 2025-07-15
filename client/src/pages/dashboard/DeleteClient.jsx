import React, { useState } from "react";
import Swal from "sweetalert2";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const DeleteClient = ({ clientId, onDeleteSuccess }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();

  const handleDelete = async () => {
    Swal.fire({
      title: "Do you really want to delete this client?",
      showDenyButton: true,
      confirmButtonText: "Yes",
      denyButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const deleteResult = await apiCall(
            "DELETE",
            `client/${clientId}`,
            undefined,
            cookies.get("auth-token")
          );
          if (deleteResult.success) {
            onDeleteSuccess(); 
            Swal.fire("Client deleted successfully", "", "success");
          } else {
            Swal.fire(deleteResult.message || "Error deleting client", "", "error");
          }
        } catch (error) {
          Swal.fire("Error deleting client", "", "error");
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

export default DeleteClient;
