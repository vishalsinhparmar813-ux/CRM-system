import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import TableServerPagination from "../../components/ui/TableServerPagination";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import OptionMetadata from "./OptionMetadata";
import DeleteSocials from "./DeleteSocials";
import DeleteTask from "./DeleteTask";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import HeadingForm from "./HeadingForm";
import AddTaskForm from "./AddTaskForm";
import EditSocialName from "./EditSocialName";
import EditTask from "./EditTask";
import BackdropLoading from "@/components/BackdropLoading";
import useToast from "../../hooks/useToast";
import Loading from "../../components/Loading";
import { createColumnHelper } from "@tanstack/react-table";

const columnHelper = createColumnHelper();

const SocialTask = () => {
  const [selectedSocialId, setSelectedSocialId] = useState(null);
  const [selectedSocialName, setSelectedSocialName] = useState(null);
  const [dailyTaskData, setDailyTaskData] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTaskName, setSelectedTaskName] = useState(null);
  const [socialData, setSocialData] = useState([]);
  const [participantsData, setParticipantsData] = useState([]);
  const [tableDataLoading, setTableDataLoading] = useState(true);
  const [isSocialTasks, setIsSocialTasks] = useState(false);
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const { toastError, toastSuccess } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showNameForm, setShowNameForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backdropLoading, setBackdropLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState([]);
  const [taskType, setTaskType] = useState(null)

  // const fetchSettingsData = async () => {
  //   try {
  //     const response = await apiCall("GET", "admin/settings", undefined, cookies.get("auth-token"));

  //     if (response.success) {
  //       setDailyTaskData(response?.data?.dailyTasks);
  //       return response.data;
  //     }
  //   } catch (err) {
  //     console.error("Error fetching data:", err);
  //   }
  // };


  console.log("socialData", socialData);
  const {
    register,
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
  } = useForm({});
  const { fields, append, remove } = useFieldArray({
    control,
    name: "tasks",
  });

  const fetchData = async () => {
    try {
      const requestedData = { key: "socialPlatforms" };
      const queryString = new URLSearchParams(requestedData).toString();

      const response = await apiCall("GET", `admin/socials?${queryString}`, undefined, cookies.get("auth-token"));

      if (response.success) {
        setSocialData(response.data);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyTasksData = async () => {
    try {
      const requestedData = { key: "dailyTasks" };
      const queryString = new URLSearchParams(requestedData).toString();

      const response = await apiCall("GET", `admin/socials?${queryString}`, undefined, cookies.get("auth-token"));
      if (response.success) {
        setDailyTaskData(response?.data);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDailyTasksData();
  }, []);

  const handleBackClick = () => {
    if (showForm || showNameForm) {
      setShowForm(false);
      setShowNameForm(false);
    } else {
      setSelectedSocialId(null);
      setSelectedTaskId(null);
      setSelectedSocialName(null);
      setShowForm(false);
      setShowNameForm(false);
    }
  };

  const handleFormCancel = () => {
    reset();
    setShowForm(false);
    setShowNameForm(false);
  };

  const onSubmitSocialName = async (data) => {
    if (!data.name) {
      toastError("Name is required");
      return;
    }
    try {
      setBackdropLoading(true);
      const response = await apiCall("POST", "admin/socials-name", data, cookies.get("auth-token"));
      if (response.success) {
        setSocialData(response.data);
        setShowForm(false);
        setShowNameForm(false);
        reset();
        toastSuccess("Social name added successfully");
      } else {
        toastError(response.message);
        console.error("Error posting data:", response.message);
      }
    } catch (error) {
      toastError("Error posting data");
      console.error("Error posting data:", error);
    } finally {
      setBackdropLoading(false);
    }
  };

  // const onSubmitTask = async (data) => {
  //   if (selectedSocialId) {
  //     try {
  //       setBackdropLoading(true);
  //       const taskData = { tasks: data.tasks, socialId: selectedSocialId };
  //       const response = await apiCall("POST", "admin/socials", taskData, cookies.get("auth-token"));
  //       if (response.success) {
  //         await fetchData();
  //         setShowForm(false);
  //         reset();
  //         toastSuccess("Task added successfully");
  //       } else {
  //         console.error("Error posting data:", response.message);
  //       }
  //     } catch (error) {
  //       console.error("Error posting data:", error);
  //     } finally {
  //       setBackdropLoading(false);
  //     }
  //   }
  // };

  // const handleOrderChange = async (socialId, taskId, newPosition) => {
  //   try {
  //     setBackdropLoading(true);
  //     const response = await apiCall("PUT", "admin/socials", { socialId, taskId, newPosition }, cookies.get("auth-token"));
  //     if (response.success) {
  //       fetchData();
  //       toastSuccess("Order updated successfully");
  //     } else {
  //       toastError(response.message);
  //     }
  //   } catch (error) {
  //     toastError("Error updating order");
  //     console.error("Error updating order:", error);
  //   } finally {
  //     setBackdropLoading(false);
  //   }
  // };

  // socialId:67402ab4dee0e48ebdcb80be
  //taskId: "67402ab4dee0e48ebdcb80bf"

  const handleParticipants = async (taskType, pageNo, recordsPerPage, taskId) => {
    try {
      setTableDataLoading(true);
      const requestedData = { key: taskType };
      const queryString = new URLSearchParams(requestedData).toString();
      const response = await apiCall(
        "GET",
        `admin/socials-stats?${queryString}&pageNo=${pageNo}&recordsPerPage=${recordsPerPage}&socialId=${selectedSocialId}&taskId=${taskId}`,
        {},
        cookies.get("auth-token")
      );

      if (response?.success) {
        console.log("participants", response);
        setParticipantsData(
          response?.data?.map((elem) => {
            return {
              ...elem,
              tg_id: elem?.tg_id,
              username: elem?.username || "-",
              playerId: elem?.playerId,
            };
          })
        );
        setPageCount(response?.totalPages);
        setTableDataLoading(false);
      } else {
        setParticipantsData([]);
        setTableDataLoading(false);
      }
    } catch (error) {
      console.log(error.message);
      toastError(error.message);
      setTableDataLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTaskId && taskType) handleParticipants(taskType, pagination?.pageIndex + 1, pagination?.pageSize, selectedTaskId);
  }, [taskType, pagination.pageIndex, pagination.pageSize, selectedTaskId]);

  const handleSocialData = (id, title) => {
    setSelectedSocialId(id);
    setSelectedSocialName(title);
    if (title === "Daily tasks") {
      setIsSocialTasks(true);
    } else {
      setIsSocialTasks(false);
    }
  };

  const columns = useMemo(() => {
    return [
      columnHelper.accessor("tg_id", {
        header: () => "TG_ID",
        enableColumnFilter: false,
      }),
      columnHelper.accessor("username", {
        header: "Username",
        enableColumnFilter: false,
      }),
      columnHelper.accessor("playerId", {
        header: "Player ID",
        enableColumnFilter: false,
      }),
    ];
  }, [backdropLoading]);

  const onPaginationChange = (val) => {
    setPagination(val);
  };
  console.log("selectedDataIdName", selectedTaskId, selectedTaskName);
  const handleParticipantsBackClick = () => {
    setSelectedTaskId(null);
    setSelectedTaskName(null);
    setParticipantsData([]);
  };

  return (
    <>
      {loading ? (
        <Loading />
      ) : !selectedTaskId ? (
        <div className="flex flex-col gap-5">
          {!selectedSocialId && (
            <div className="flex justify-between flex-wrap items-center mb-6 md:flex-row flex-col">
              <h4 className="font-medium lg:text-2xl text-xl capitalize text-slate-900 inline-block pr-4">Social Task Management</h4>
            </div>
          )}

          {/* Social Task Accordion */}
          {!selectedSocialId &&
            !showForm &&
            !showNameForm &&
            socialData?.map((item) => (
              <div
                key={item._id}
                className="w-full bg-slate-600 min-h-20 border rounded-md border-slate-600 flex cursor-pointer hover:bg-slate-500 justify-between items-center px-5 py-1"
                onClick={() => handleSocialData(item?._id, item?.title)}
              >
                <span className="card-title text-xl font-semibold">{item?.title}</span>
                <div className="flex flex-row gap-5">
                  <div>
                    <Icon icon={"iconamoon:arrow-right-2-light"} width={30} className="cursor-pointer" />
                  </div>
                </div>
              </div>
            ))}

          {/* Daily Tasks Accordion */}
          {dailyTaskData && dailyTaskData.length > 0 && !selectedSocialId && !showForm && !showNameForm && (
            <div
              key={dailyTaskData[0]?._id}
              className="w-full bg-slate-600 min-h-20 border rounded-md border-slate-600 flex justify-between cursor-pointer hover:bg-slate-500 items-center px-5 py-1 "
              onClick={() => handleSocialData(dailyTaskData[0]?._id, dailyTaskData[0]?.title)}
            >
              <span className="card-title text-xl font-semibold">{dailyTaskData[0]?.title}</span>
              <div className="flex flex-row gap-5">
                <div>
                  <Icon icon={"iconamoon:arrow-right-2-light"} width={30} className="cursor-pointer" />
                </div>
              </div>
            </div>
          )}

          {/* Social Tasks Table */}
          {!isSocialTasks && socialData.length > 0 && selectedSocialId && !showForm && !showNameForm && (
            <div className="w-full">
              <div className="flex justify-between flex-wrap items-center mb-6">
                <button onClick={handleBackClick} className="text-white mb-4 self-start">
                  <Icon icon={"eva:arrow-back-fill"} width={30} />
                </button>

                <AddTaskForm socialId={selectedSocialId} onSubmit={fetchData} dailyTasks={false} />
              </div>
              <Card title={selectedSocialName} noborder>
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-100 table-fixed dark:divide-slate-700">
                        <thead className="bg-slate-200 dark:bg-slate-700">
                          <tr>
                            <th className="table-th px-4 py-2">Reward(Sake)</th>
                            <th className="table-th px-4 py-2">Title</th>
                            <th className="table-th px-4 py-2">Link</th>
                            <th className="table-th px-4 py-2">Participants</th>
                            <th className="table-th px-4 py-2">Type</th>

                            <th className="table-th px-4 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 dark:bg-slate-800 dark:divide-slate-700">
                          {socialData
                            .filter((social) => social._id === selectedSocialId)[0]
                            .tasks.map((task, index) => (
                              <tr key={task?._id}>
                                <td className="table-td px-4 py-2">{task?.reward?.sake}</td>
                                <td className="table-td px-4 py-2">{task?.title}</td>
                                <td className="table-td px-4 py-2">
                                  {task.type === "redirect" && task?.link ? (
                                    <a href={task?.link} target="_blank" rel="noopener noreferrer">
                                      {task?.link}
                                    </a>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                                <td className="table-td px-4 py-2">{task?.participants}</td>
                                <td className="table-td px-4 py-2">{task?.type}</td>

                                <td className="table-td px-4 py-2">
                                  <div className="flex space-x-2 items-center">
                                    <EditTask
                                      socialId={selectedSocialId}
                                      taskDetails={task}
                                      taskId={task._id}
                                      reward={task.reward}
                                      name={task.name}
                                      link={task.link}
                                      participants={task.participants}
                                      type={task.type}
                                      onSubmit={fetchData}
                                      dailyTasks={false}
                                    />
                                    <DeleteTask socialId={selectedSocialId} taskId={task._id} onDeleteSuccess={fetchData} />
                                    <div
                                      className="cursor-pointer hover:bg-slate-500 px-2"
                                      onClick={() => {
                                        setTaskType("socialPlatforms")
                                        setSelectedTaskId(task?._id);
                                        setSelectedTaskName(task?.title);
                                      }}
                                    >
                                      <span className="text-base inline-block  rtl:mr-[10px] cursor-pointer p-2">
                                        <Icon icon="heroicons-outline:chevron-right" />
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Daily Tasks Table*/}
          {isSocialTasks && dailyTaskData.length > 0 && selectedSocialId && !showForm && !showNameForm && (
            <div className="w-full">
              <div className="flex justify-between flex-wrap items-center mb-6">
                <button onClick={handleBackClick} className="text-white mb-4 self-start">
                  <Icon icon={"eva:arrow-back-fill"} width={30} />
                </button>

                <AddTaskForm socialId={selectedSocialId} dailyTasks={true} onSubmit={fetchDailyTasksData} />
              </div>
              <Card title={selectedSocialName} noborder>
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-100 table-fixed dark:divide-slate-700">
                        <thead className="bg-slate-200 dark:bg-slate-700">
                          <tr>
                            <th className="table-th px-4 py-2">Reward(Sake)</th>
                            <th className="table-th px-4 py-2">Title</th>
                            <th className="table-th px-4 py-2">Link</th>
                            <th className="table-th px-4 py-2">Participants</th>
                            <th className="table-th px-4 py-2">Type</th>
                            <th className="table-th px-4 py-2">Action</th>

                            {/* <th className="table-th px-4 py-2">Order</th> */}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 dark:bg-slate-800 dark:divide-slate-700">
                          {dailyTaskData[0]?.tasks?.map((task, index) => (
                            <tr key={task?._id}>
                              <td className="table-td px-4 py-2">{task?.reward?.sake}</td>
                              <td className="table-td px-4 py-2">{task?.title}</td>
                              <td className="table-td px-4 py-2">
                                {task.type === "redirect" && task?.link ? (
                                  <a href={task?.link} target="_blank" rel="noopener noreferrer">
                                    {task?.link}
                                  </a>
                                ) : (
                                  <span>-</span>
                                )}
                              </td>
                              <td className="table-td px-4 py-2">{task?.participants}</td>
                              <td className="table-td px-4 py-2">{task?.type}</td>
                              <td className="table-td px-4 py-2">
                                <div className="flex space-x-2 items-center">
                                  <EditTask
                                    socialId={selectedSocialId}
                                    taskDetails={task}
                                    taskId={task._id}
                                    reward={task.reward}
                                    name={task.name}
                                    link={task.link}
                                    participants={task.participants}
                                    type={task.type}
                                    onSubmit={fetchDailyTasksData}
                                    dailyTasks={true}
                                  />
                                  <DeleteTask
                                    socialId={selectedSocialId}
                                    taskId={task._id}
                                    onDeleteSuccess={fetchDailyTasksData}
                                    dailyTasks={true}
                                  />
                                  <div
                                    onClick={() => {
                                      setTaskType("dailyTasks")
                                      setSelectedTaskId(task?._id);
                                      setSelectedTaskName(task?.title);
                                    }}
                                  >
                                    <span className="text-base inline-block  rtl:mr-[10px] cursor-pointer p-2">
                                      <Icon icon="heroicons-outline:chevron-right" />
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {showForm && (
            <div className="w-full">
              <AddTaskForm />
            </div>
          )}
          {showNameForm && (
            <div className="w-full">
              <button onClick={handleBackClick} className="text-white mb-4">
                <Icon icon={"eva:arrow-back-fill"} width={30} />
              </button>

              <form onSubmit={handleSubmit(onSubmitSocialName)}>
                <div className="bg-slate-600 p-4 rounded-md mb-4">
                  <div className="mb-2 flex items-center is-valid flex-col">
                    <label className="block text-sm font-medium mb-1 w-full">Social Heading</label>

                    <input
                      type="text"
                      {...register("name", {
                        required: "Name is required",
                      })}
                      className="form-control py-2"
                    />
                    {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
                  </div>
                  <div className="flex justify-end">
                    <Button text="Cancel" type="button" onClick={handleFormCancel} />
                    <Button text="Submit" type="submit" className="btn-primary ml-2" />
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        <>
          <button onClick={handleParticipantsBackClick} className="text-white mb-4 self-start">
            <Icon icon={"eva:arrow-back-fill"} width={30} />
          </button>
          <h4 className="font-medium lg:text-2xl text-xl capitalize text-slate-900 inline-block pr-4 mx-10 mt-[-10px] mb-10">
            {selectedTaskName}
          </h4>
          <TableServerPagination
            tableData={participantsData}
            columns={columns}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            pageCount={pageCount}
            tableDataLoading={tableDataLoading}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            isParticipantsData={true}
          />
        </>
      )}
    </>
  );
};

export default SocialTask;
