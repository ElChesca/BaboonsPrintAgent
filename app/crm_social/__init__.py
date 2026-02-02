from flask import Blueprint

bp = Blueprint('crm_social', __name__)

from . import routes
from . import leads_routes
