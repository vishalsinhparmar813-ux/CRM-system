// routes/orders.js
const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/auth')
const authorize = require('../middlewares/authorize')
const logger = require('../utils/logger')
const rolesEnum = require('../enums/roles')
const clientController = require('../controllers/clientController')

/**
 * @POST
 * @desc Create a new client
 * @access Admin
 */
router.post('/', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	console.log('Received client creation request body:', req.body); // DEBUG LOG
	try {
		logger.info('request received to create a new client')
		const { name, alias, email, mobile, correspondenceAddress, permanentAddress } =
			req.body

		if (!name) {
			return res.status(400).json({ message: 'Name is required' })
		}
		// Email is now optional - no validation needed
		if (!mobile) {
			return res.status(400).json({ message: 'mobile is required' })
		}

		// Only check for duplicate email if email is provided
		if (email && email.trim()) {
			try {
				const existingClient = await clientController.getClientByEmail(email)
				if (existingClient) {
					return res.status(400).json({ message: 'Client with this email already exists' })
				}
			} catch (error) {
				logger.error(`Error in checking client by email: ${error.message}`)
				if (error.statusCode && error.statusCode === 404) {
					// Client not found, proceed to check mobile
				} else {
					return res.status(500).json({ message: 'Internal server error' })
				}
			}
		}

		// Check for duplicate mobile number
		try {
			const existingClientByMobile = await clientController.getClientByMobile(mobile)
			if (existingClientByMobile) {
				return res.status(400).json({ message: 'Client with this mobile number already exists' })
			}
		} catch (error) {
			logger.error(`Error in checking client by mobile: ${error.message}`)
			if (error.statusCode && error.statusCode === 404) {
				// Client not found, proceed to create a new one
			} else {
				return res.status(500).json({ message: 'Internal server error' })
			}
		}

		const client = await clientController.createNewClient(
			name,
			alias,
			email,
			mobile,
			correspondenceAddress,
			permanentAddress
		)
		// res.status(201).json(client)
		res.status(201).json({
			success: true,
			message: 'Client created successfully',
			client,
		});
	} catch (error) {
		logger.error(`Error in creating client: ${error.message}`)
		res.status(500).json({ message: 'Internal server error' })
	}
})

/**
 * @GET
 * @desc Get all clients with pagination
 * @access Admin
 */
router.get('/all', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
	try {
		logger.info('request received to get all clients with pagination')
		const { page, limit } = req.query;
		const result = await clientController.getAllClients(page, limit)
		res.status(200).json({
			success: true,
			data: result.clients,
			pagination: result.pagination
		})
	} catch (error) {
		logger.error(`Error in getting clients: ${error.message}`)
		res.status(500).json({ message: 'Internal server error' })
	}
})

/**
 * @GET
 * @desc Get client by id
 * @access Admin
 */
router.get(
	'/:clientId',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info('request received to get client by id')
			const { clientId } = req.params
			if (!clientId) {
				return res.status(400).json({ message: 'Client ID is required' })
			}
			const client = await clientController.getClientById(clientId)
			if (!client) {
				return res.status(404).json({ message: 'Client not found' })
			}
			res.status(200).json(client)
		} catch (error) {
			logger.error(`Error in getting client: ${error.message}`)
			res.status(500).json({ message: 'Internal server error' })
		}
	}
)

/**
 * @PATCH
 * @desc Update a client by ID
 * @access Admin
 */
router.patch(
  '/:clientId',
  authenticate,
  authorize(rolesEnum.ADMIN),
  async (req, res) => {
    try {
      logger.info('request received to update client')
      const { clientId } = req.params
      const { name, alias, email, mobile, correspondenceAddress, permanentAddress } = req.body

      if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required' })
      }

      if (!name) {
        return res.status(400).json({ message: 'Name is required' })
      }

      if (!mobile) {
        return res.status(400).json({ message: 'Mobile is required' })
      }

      // Check if client exists
      const existingClient = await clientController.getClientById(clientId)
      if (!existingClient) {
        return res.status(404).json({ message: 'Client not found' })
      }

      // Only check for duplicate email if email is provided and different from current
      if (email && email.trim() && email !== existingClient.email) {
        try {
          const existingClientByEmail = await clientController.getClientByEmail(email)
          if (existingClientByEmail && existingClientByEmail._id.toString() !== clientId) {
            return res.status(400).json({ message: 'Client with this email already exists' })
          }
        } catch (error) {
          logger.error(`Error in checking client by email: ${error.message}`)
          if (error.statusCode && error.statusCode !== 404) {
            return res.status(500).json({ message: 'Internal server error' })
          }
        }
      }

      // Check for duplicate mobile number if different from current
      if (mobile !== existingClient.mobile) {
        try {
          const existingClientByMobile = await clientController.getClientByMobile(mobile)
          if (existingClientByMobile && existingClientByMobile._id.toString() !== clientId) {
            return res.status(400).json({ message: 'Client with this mobile number already exists' })
          }
        } catch (error) {
          logger.error(`Error in checking client by mobile: ${error.message}`)
          if (error.statusCode && error.statusCode !== 404) {
            return res.status(500).json({ message: 'Internal server error' })
          }
        }
      }

      const updatedClient = await clientController.updateClientById(
        clientId,
        name,
        alias,
        email,
        mobile,
        correspondenceAddress,
        permanentAddress
      )

      res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        client: updatedClient,
      })
    } catch (error) {
      logger.error(`Error in updating client: ${error.message}`)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

/**
 * @DELETE
 * @desc Delete a client by ID
 * @access Admin
 */
router.delete(
  '/:clientId',
  authenticate,
  authorize(rolesEnum.ADMIN),
  async (req, res) => {
    try {
      logger.info('request received to delete client')
      const { clientId } = req.params

      if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required' })
      }

      const deletedClient = await clientController.deleteClientById(clientId)

      if (!deletedClient) {
        return res.status(404).json({ message: 'Client not found' })
      }

      res.status(200).json({
        success: true,
        message: 'Client deleted successfully',
		client: deletedClient,
      })
    } catch (error) {
      logger.error(`Error in deleting client: ${error.message}`)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

/**
 * @GET
 * @desc Search clients by name, alias, or mobile number with pagination
 * @access Admin
 */
router.get('/search/:searchTerm', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		logger.info('request received to search clients with pagination')
		const { searchTerm } = req.params
		const { page, limit, suggestion } = req.query;
		logger.info(`request query params: ${JSON.stringify(req.query)}`)
		if (!searchTerm) {
			return res.status(400).json({ message: 'Search term is required' })
		}
		const result = await clientController.searchClients(searchTerm, page, limit, suggestion === 'true')
		res.status(200).json({
			success: true,
			data: result.clients,
			pagination: result.pagination
		})
	} catch (error) {
		logger.error(`Error in searching clients: ${error.message}`)
		res.status(500).json({ message: 'Internal server error' })
	}
})

module.exports = router
